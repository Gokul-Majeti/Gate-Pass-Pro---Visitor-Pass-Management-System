import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { generateQrPngBuffer, signQrToken } from './passService.js';

function resolveLocalPhotoPath(photoUrl) {
  if (!photoUrl || !photoUrl.startsWith('/uploads/')) return null;
  const relative = photoUrl.replace(/^\/uploads\//, '');
  const fullPath = path.resolve(env.uploadDir, relative);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generates a printable Visitor ID Badge PDF buffer featuring organization branding,
 * visitor photo, host & validity details, and a scannable QR code.
 */
export async function buildVisitorPassPdfBuffer({ pass, visitor, host, appointment, organization }) {
  const qrToken =
    pass.qrToken || signQrToken(pass.passCode, pass.organizationId, pass.appointmentId);
  const qrBuffer = await generateQrPngBuffer(qrToken);
  const photoPath = resolveLocalPhotoPath(visitor?.photoUrl);

  const primaryColor = organization?.settings?.primaryColor || '#2563eb';
  const orgName = organization?.name || 'GatePass Organization';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [340, 520],
      margin: 0,
      info: {
        Title: `Visitor Pass ${pass.passCode}`,
        Author: orgName,
        Subject: `Digital Visitor Badge for ${visitor?.fullName || 'Visitor'}`,
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Outer card background
    doc.rect(0, 0, 340, 520).fill('#ffffff');

    // Header bar
    doc.rect(0, 0, 340, 76).fill(primaryColor);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(orgName, 20, 18, { width: 230, ellipsis: true });
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#dbeafe')
      .text(`${pass.locationName || 'Main Campus'} • VISITOR PASS`, 20, 40, {
        width: 240,
      });

    // Status pill in header
    doc.roundedRect(250, 22, 70, 22, 11).fill('#ffffff');
    doc
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(String(pass.status || 'ACTIVE').toUpperCase(), 250, 29, {
        width: 70,
        align: 'center',
      });

    // Visitor photo or initials circle
    const photoX = 24;
    const photoY = 94;
    const photoSize = 68;
    if (photoPath) {
      try {
        doc.save();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 10).clip();
        doc.image(photoPath, photoX, photoY, {
          fit: [photoSize, photoSize],
          align: 'center',
          valign: 'center',
        });
        doc.restore();
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 10).lineWidth(1).stroke('#cbd5e1');
      } catch {
        doc.roundedRect(photoX, photoY, photoSize, photoSize, 10).fill('#e2e8f0');
      }
    } else {
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 10).fill('#eff6ff');
      doc.roundedRect(photoX, photoY, photoSize, photoSize, 10).lineWidth(1).stroke('#bfdbfe');
      const initials = (visitor?.fullName || 'V')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      doc
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text(initials, photoX, photoY + 22, { width: photoSize, align: 'center' });
    }

    // Visitor name & company
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(visitor?.fullName || 'Guest Visitor', 106, 98, { width: 214, ellipsis: true });
    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(10)
      .text(visitor?.company || 'Independent', 106, 118, { width: 214, ellipsis: true });
    doc
      .fillColor('#64748b')
      .fontSize(8.5)
      .text(
        `ID: ${String(visitor?.idType || 'national_id').replace('_', ' ').toUpperCase()}${visitor?.idNumber ? ` (${visitor.idNumber})` : ''}`,
        106,
        136,
        { width: 214, ellipsis: true }
      );

    // Divider
    doc.moveTo(20, 178).lineTo(320, 178).lineWidth(0.75).stroke('#e2e8f0');

    // Visit metadata grid
    const fields = [
      ['HOST', host ? `${host.name}${host.department ? ` (${host.department})` : ''}` : 'Reception'],
      ['PURPOSE', appointment?.purpose || 'Scheduled Visit'],
      ['VALID FROM', formatDateTime(pass.validFrom)],
      ['VALID UNTIL', formatDateTime(pass.validUntil)],
    ];

    let y = 192;
    for (const [label, value] of fields) {
      doc
        .fillColor('#64748b')
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(label, 24, y);
      doc
        .fillColor('#0f172a')
        .font('Helvetica')
        .fontSize(9.5)
        .text(value, 106, y - 1, { width: 212, ellipsis: true });
      y += 26;
    }

    if (appointment?.requireOtp) {
      doc.roundedRect(24, y, 292, 20, 4).fill('#fef3c7');
      doc
        .fillColor('#92400e')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('OTP VERIFICATION REQUIRED AT SECURITY CHECK-IN', 24, y + 6, {
          width: 292,
          align: 'center',
        });
      y += 28;
    }

    // QR section box
    const qrBoxY = Math.max(y + 4, 312);
    doc.roundedRect(70, qrBoxY, 200, 160, 10).fill('#f8fafc');
    doc.roundedRect(70, qrBoxY, 200, 160, 10).lineWidth(0.75).stroke('#e2e8f0');

    doc.image(qrBuffer, 110, qrBoxY + 12, { width: 120, height: 120 });
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text(pass.passCode, 70, qrBoxY + 138, { width: 200, align: 'center' });

    // Footer
    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        `Present this badge at ${pass.locationName} Security Reception • Generated by GatePass Pro`,
        20,
        494,
        { width: 300, align: 'center' }
      );

    doc.end();
  });
}
