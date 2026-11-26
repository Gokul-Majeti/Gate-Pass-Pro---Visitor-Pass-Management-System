import { stringify } from 'csv-stringify/sync';
import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { Appointment, CheckLog, Pass, Visitor } from '../models/index.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

router.get(
  '/analytics',
  authenticate,
  authorizeRoles('admin', 'security', 'host'),
  asyncHandler(async (req, res) => {
    const { locationName, days = '14' } = req.query;
    const lookbackDays = Math.min(90, Math.max(7, Number(days) || 14));

    const orgScope = { organizationId: req.organizationId };
    if (locationName) orgScope.locationName = locationName;
    if (req.user.role === 'host') orgScope.hostId = req.user._id;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const windowStart = new Date(startOfToday);
    windowStart.setDate(windowStart.getDate() - (lookbackDays - 1));

    const logScope = { organizationId: req.organizationId };
    if (locationName) logScope.locationName = locationName;
    if (req.user.role === 'host') {
      const hostApts = await Appointment.find(orgScope).select('_id');
      logScope.appointmentId = { $in: hostApts.map((a) => a._id) };
    }

    const [
      currentlyOnSite,
      todayAppointments,
      pendingApprovals,
      activePasses,
      todayCheckIns,
      todayCheckOuts,
      totalVisitors,
      recentAppointments,
      recentCheckLogs,
      statusGroups,
      categoryGroups,
      locationGroups,
    ] = await Promise.all([
      Pass.countDocuments({ ...orgScope, status: 'checked_in' }),
      Appointment.countDocuments({
        ...orgScope,
        scheduledStart: { $gte: startOfToday, $lte: endOfToday },
      }),
      Appointment.countDocuments({ ...orgScope, status: 'pending' }),
      Pass.countDocuments({ ...orgScope, status: { $in: ['active', 'checked_in'] } }),
      CheckLog.countDocuments({
        ...logScope,
        action: 'check_in',
        timestamp: { $gte: startOfToday, $lte: endOfToday },
      }),
      CheckLog.countDocuments({
        ...logScope,
        action: 'check_out',
        timestamp: { $gte: startOfToday, $lte: endOfToday },
      }),
      Visitor.countDocuments({ organizationId: req.organizationId }),
      Appointment.find({
        ...orgScope,
        scheduledStart: { $gte: windowStart },
      }).select('scheduledStart status'),
      CheckLog.find({
        ...logScope,
        timestamp: { $gte: windowStart },
      }).select('passId action timestamp'),
      Appointment.aggregate([
        { $match: orgScope },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: orgScope },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { organizationId: req.organizationId } },
        { $group: { _id: '$locationName', count: { $sum: 1 } } },
      ]),
    ]);

    // Compute daily trend buckets
    const dailyMap = new Map();
    for (let i = 0; i < lookbackDays; i += 1) {
      const d = new Date(windowStart);
      d.setDate(windowStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, {
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        appointments: 0,
        checkIns: 0,
        checkOuts: 0,
      });
    }

    for (const apt of recentAppointments) {
      const key = new Date(apt.scheduledStart).toISOString().slice(0, 10);
      if (dailyMap.has(key)) {
        dailyMap.get(key).appointments += 1;
      }
    }

    const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      checkIns: 0,
    }));

    const passCheckPairs = new Map();
    for (const log of recentCheckLogs) {
      const key = new Date(log.timestamp).toISOString().slice(0, 10);
      if (dailyMap.has(key)) {
        if (log.action === 'check_in') dailyMap.get(key).checkIns += 1;
        if (log.action === 'check_out') dailyMap.get(key).checkOuts += 1;
      }
      if (log.action === 'check_in') {
        const hour = new Date(log.timestamp).getHours();
        if (hourBuckets[hour]) hourBuckets[hour].checkIns += 1;
      }
      if (log.action === 'check_in' || log.action === 'check_out') {
        const pid = String(log.passId);
        if (!passCheckPairs.has(pid)) passCheckPairs.set(pid, {});
        passCheckPairs.get(pid)[log.action] = new Date(log.timestamp).getTime();
      }
    }

    let durationSumMin = 0;
    let durationCount = 0;
    for (const pair of passCheckPairs.values()) {
      if (pair.check_in && pair.check_out && pair.check_out >= pair.check_in) {
        durationSumMin += (pair.check_out - pair.check_in) / 60000;
        durationCount += 1;
      }
    }

    res.json({
      success: true,
      kpis: {
        currentlyOnSite,
        todayAppointments,
        pendingApprovals,
        activePasses,
        todayCheckIns,
        todayCheckOuts,
        totalVisitors,
        avgVisitDurationMinutes:
          durationCount > 0 ? Math.round(durationSumMin / durationCount) : 0,
      },
      dailyTrend: Array.from(dailyMap.values()),
      byStatus: statusGroups.map((g) => ({ name: g._id, value: g.count })),
      byCategory: categoryGroups.map((g) => ({ name: g._id, value: g.count })),
      byLocation: locationGroups.map((g) => ({ name: g._id, value: g.count })),
      peakHours: hourBuckets.filter((_, idx) => idx >= 7 && idx <= 20),
    });
  })
);

router.get(
  '/export',
  authenticate,
  authorizeRoles('admin', 'security'),
  asyncHandler(async (req, res) => {
    const { status, locationName, from, to, search } = req.query;
    const filter = { organizationId: req.organizationId };

    if (status) filter.status = status;
    if (locationName) filter.locationName = locationName;
    if (from || to) {
      filter.scheduledStart = {};
      if (from) filter.scheduledStart.$gte = new Date(from);
      if (to) filter.scheduledStart.$lte = new Date(to);
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      const visitors = await Visitor.find({
        organizationId: req.organizationId,
        $or: [{ fullName: regex }, { email: regex }, { company: regex }],
      }).select('_id');
      filter.$or = [
        { purpose: regex },
        { visitorId: { $in: visitors.map((v) => v._id) } },
      ];
    }

    const appointments = await Appointment.find(filter)
      .populate('visitorId', 'fullName email phone company idType idNumber')
      .populate('hostId', 'name email department')
      .sort({ scheduledStart: -1 })
      .limit(1000)
      .lean();

    const aptIds = appointments.map((a) => a._id);
    const [passes, logs] = await Promise.all([
      Pass.find({ appointmentId: { $in: aptIds } }).lean(),
      CheckLog.find({ appointmentId: { $in: aptIds } }).sort({ timestamp: 1 }).lean(),
    ]);

    const passMap = new Map(passes.map((p) => [String(p.appointmentId), p]));
    const checkMap = new Map();
    for (const log of logs) {
      const key = String(log.appointmentId);
      if (!checkMap.has(key)) checkMap.set(key, {});
      if (log.action === 'check_in' && !checkMap.get(key).checkIn) {
        checkMap.get(key).checkIn = log.timestamp;
      }
      if (log.action === 'check_out') {
        checkMap.get(key).checkOut = log.timestamp;
      }
    }

    const rows = appointments.map((apt) => {
      const pass = passMap.get(String(apt._id));
      const times = checkMap.get(String(apt._id)) || {};
      return {
        AppointmentID: String(apt._id),
        PassCode: pass?.passCode || 'N/A',
        PassStatus: pass?.status || 'NOT_ISSUED',
        AppointmentStatus: apt.status,
        Type: apt.type,
        Location: apt.locationName,
        VisitorName: apt.visitorId?.fullName || '',
        VisitorEmail: apt.visitorId?.email || '',
        VisitorPhone: apt.visitorId?.phone || '',
        Company: apt.visitorId?.company || '',
        HostName: apt.hostId?.name || '',
        HostDepartment: apt.hostId?.department || '',
        Purpose: apt.purpose,
        Category: apt.category,
        ScheduledStart: new Date(apt.scheduledStart).toISOString(),
        ScheduledEnd: new Date(apt.scheduledEnd).toISOString(),
        CheckedInAt: times.checkIn ? new Date(times.checkIn).toISOString() : '',
        CheckedOutAt: times.checkOut ? new Date(times.checkOut).toISOString() : '',
      };
    });

    const csv = stringify(rows, { header: true });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="visitor-report-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  })
);

export default router;
