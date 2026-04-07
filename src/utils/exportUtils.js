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
 * Ekspor data ke PDF
 */
export const exportToPDF = (data, columns, filename = 'laporan', title = 'Laporan', options = {}) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title - centered
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth / 2, 26, { align: 'center' });

    // Table
    const head = [columns.map(c => c.header)];
    const body = data.map((row, i) =>
        columns.map(col => {
            const val = col.accessor ? col.accessor(row, i) : row[col.key] ?? '';
            return String(val);
        })
    );

    // Build noWrap column styles
    const noWrapCols = options.noWrapCols || [];
    const columnStyles = {};
    columns.forEach((col, idx) => {
        if (noWrapCols.includes(col.header)) {
            columnStyles[idx] = { cellWidth: 'wrap', overflow: 'visible' };
        }
    });

    autoTable(doc, {
        startY: 32,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
        columnStyles,
    });

    doc.save(`${filename}.pdf`);
};
