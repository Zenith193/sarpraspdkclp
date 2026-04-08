import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Ekspor data ke Excel (.xlsx)
 */
export const exportToExcel = (data, columns, filename = 'laporan') => {
    const rows = data.map((row, i) =>
        columns.reduce((acc, col) => {
            acc[col.header] = col.accessor ? col.accessor(row, i) : row[col.key] ?? '';
            return acc;
        }, {})
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');

    // Auto column width
    const colWidths = columns.map(col => ({
        wch: Math.max(
            col.header.length + 2,
            ...rows.map(r => String(r[col.header] ?? '').length)
        )
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Ekspor multi-sheet ke Excel (.xlsx)
 * @param {Array<{sheetName: string, data: Array, columns: Array}>} sheets
 */
export const exportToExcelMultiSheet = (sheets, filename = 'laporan') => {
    const wb = XLSX.utils.book_new();
    for (const { sheetName, data, columns } of sheets) {
        const rows = data.map((row, i) =>
            columns.reduce((acc, col) => {
                acc[col.header] = col.accessor ? col.accessor(row, i) : row[col.key] ?? '';
                return acc;
            }, {})
        );
        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = columns.map(col => ({
            wch: Math.max(col.header.length + 2, ...rows.map(r => String(r[col.header] ?? '').length))
        }));
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Ekspor data ke CSV
 */
export const exportToCSV = (data, columns, filename = 'laporan') => {
    const headers = columns.map(c => c.header).join(',');
    const rows = data.map((row, i) =>
        columns.map(col => {
            const val = col.accessor ? col.accessor(row, i) : row[col.key] ?? '';
            const str = String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
};

/**
 * Ekspor data ke PDF — Premium Design with smart column sizing
 */
export const exportToPDF = (data, columns, filename = 'laporan', title = 'Laporan', options = {}) => {
    const colCount = columns.length;
    const orientation = colCount > 6 ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const subtitle = options.subtitle || '';
    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // Dynamic font sizing based on column count
    let fontSize = 8;
    let headerFontSize = 8;
    let cellPadding = { top: 3, right: 4, bottom: 3, left: 4 };
    if (colCount > 12) { fontSize = 6; headerFontSize = 6; cellPadding = { top: 2, right: 2, bottom: 2, left: 2 }; }
    else if (colCount > 9) { fontSize = 6.5; headerFontSize = 6.5; cellPadding = { top: 2, right: 3, bottom: 2, left: 3 }; }
    else if (colCount > 6) { fontSize = 7; headerFontSize = 7; cellPadding = { top: 3, right: 3, bottom: 3, left: 3 }; }

    // === HEADER BANNER ===
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 28, pageWidth, 3, 'F');
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), pageWidth / 2, 13, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 255);
    doc.text(subtitle || 'Dinas Pendidikan dan Kebudayaan Kabupaten Cilacap', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(180, 195, 255);
    doc.text(`Diekspor: ${dateStr}  •  Total: ${data.length} data`, pageWidth / 2, 26, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // === TABLE DATA ===
    const head = [columns.map(c => c.header)];
    const body = data.map((row, i) =>
        columns.map(col => {
            const val = col.accessor ? col.accessor(row, i) : row[col.key] ?? '';
            return String(val);
        })
    );

    // Find special column indices
    const kondisiIdx = columns.findIndex(c => c.key === 'kondisi' || c.header === 'Kondisi');
    const statusIdx = columns.findIndex(c => c.key === 'status' || c.header === 'Status');
    const nilaiIdx = columns.findIndex(c => c.header === 'Nilai Pengajuan');
    const noIdx = columns.findIndex(c => c.header === 'No');

    // === SMART COLUMN WIDTHS ===
    const tableWidth = pageWidth - 20;
    const userWidths = options.colWidths || {};
    const noWrapCols = options.noWrapCols || [];

    const narrowHeaders = ['No', 'Lt', 'Lantai', 'Masa', 'Masa Bangunan', 'Jenjang', 'Prioritas'];
    const medHeaders = ['NPSN', 'Panjang (m)', 'Lebar (m)', 'Luas (m²)', 'Kondisi', 'Tipe', 'Status', 'Target', 'Urutan Prioritas'];
    const wideHeaders = ['Nama Sekolah', 'Sekolah', 'Kecamatan', 'Jenis Prasarana', 'Nama Ruang', 'Keterangan', 'Alasan', 'Alasan / Keterangan', 'Nama Paket'];

    let totalWeight = 0;
    const weights = columns.map(col => {
        if (userWidths[col.header]) return 0;
        let w;
        if (narrowHeaders.includes(col.header)) w = 1;
        else if (medHeaders.includes(col.header)) w = 1.5;
        else if (wideHeaders.includes(col.header)) w = 3;
        else w = 2;
        totalWeight += w;
        return w;
    });

    let fixedWidth = 0;
    columns.forEach((col) => { if (userWidths[col.header]) fixedWidth += userWidths[col.header]; });
    const flexWidth = tableWidth - fixedWidth;

    const columnStyles = {};
    columns.forEach((col, idx) => {
        const s = {};
        if (userWidths[col.header]) { s.cellWidth = userWidths[col.header]; }
        else if (totalWeight > 0) { s.cellWidth = (weights[idx] / totalWeight) * flexWidth; }
        if (noWrapCols.includes(col.header)) { s.cellWidth = 'wrap'; s.overflow = 'visible'; }
        if (idx === noIdx) s.halign = 'center';
        if (narrowHeaders.includes(col.header) || medHeaders.includes(col.header)) s.halign = 'center';
        if (col.header === 'Nilai Pengajuan' || col.header === 'Luas (m²)') s.halign = 'right';
        if (wideHeaders.includes(col.header)) s.halign = 'left';
        if (Object.keys(s).length > 0) columnStyles[idx] = s;
    });

    autoTable(doc, {
        startY: 35,
        head,
        body,
        theme: 'grid',
        styles: {
            fontSize,
            cellPadding,
            lineColor: [220, 225, 235],
            lineWidth: 0.3,
            overflow: 'linebreak',
            valign: 'middle',
        },
        headStyles: {
            fillColor: [37, 99, 235],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: headerFontSize,
            cellPadding,
            lineColor: [30, 64, 175],
            lineWidth: 0.3,
        },
        alternateRowStyles: { fillColor: [245, 247, 252] },
        bodyStyles: { textColor: [30, 41, 59] },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto',
        columnStyles,
        didParseCell: (hookData) => {
            if (hookData.section !== 'body') return;
            if (hookData.column.index === kondisiIdx && kondisiIdx >= 0) {
                const val = (hookData.cell.raw || '').toUpperCase();
                if (val === 'BAIK') { hookData.cell.styles.textColor = [22, 163, 74]; hookData.cell.styles.fontStyle = 'bold'; }
                else if (val === 'RUSAK RINGAN') { hookData.cell.styles.textColor = [37, 99, 235]; hookData.cell.styles.fontStyle = 'bold'; }
                else if (val === 'RUSAK SEDANG') { hookData.cell.styles.textColor = [217, 119, 6]; hookData.cell.styles.fontStyle = 'bold'; }
                else if (val === 'RUSAK BERAT') { hookData.cell.styles.textColor = [220, 38, 38]; hookData.cell.styles.fontStyle = 'bold'; }
            }
            if (hookData.column.index === statusIdx && statusIdx >= 0) {
                const val = (hookData.cell.raw || '');
                if (val === 'Disetujui' || val === 'Diterima') { hookData.cell.styles.textColor = [22, 163, 74]; hookData.cell.styles.fontStyle = 'bold'; }
                else if (val === 'Ditolak') { hookData.cell.styles.textColor = [220, 38, 38]; hookData.cell.styles.fontStyle = 'bold'; }
                else if (val === 'Revisi') { hookData.cell.styles.textColor = [217, 119, 6]; hookData.cell.styles.fontStyle = 'bold'; }
                else if (val.includes('Menunggu')) { hookData.cell.styles.textColor = [37, 99, 235]; }
            }
            if (hookData.column.index === nilaiIdx && nilaiIdx >= 0) { hookData.cell.styles.fontStyle = 'bold'; }
        },
        didDrawPage: (hookData) => {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150);
            doc.text(`Halaman ${hookData.pageNumber}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
            doc.setDrawColor(200, 210, 225);
            doc.setLineWidth(0.3);
            doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
            doc.setFontSize(6.5);
            doc.text('SARDIKA — Portal Data Sarpras Pendidikan Cilacap', pageWidth - 10, pageHeight - 8, { align: 'right' });
        },
    });

    doc.save(`${filename}.pdf`);
};
