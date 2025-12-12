import ExcelJS from 'exceljs';
import FileSaver from 'file-saver';
import { ClientDetails, Room, BrandingSettings, Currency, ViewMode } from '../types';
import { getExchangeRates } from './currency';
import { companyTemplate } from '../data/scopeAndTermsData';

// Handle file-saver import which might be an object with saveAs property or the function itself
const saveAs = (FileSaver as any).saveAs || FileSaver;

// Helper to round numbers to 2 decimal places to avoid clutter
const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

// Types for the generator
interface ProjectDetails {
    'Project Name'?: string;
    'Client Name'?: string;
    'Location'?: string;
    'Design Engineer'?: string;
    'Account Manager'?: string;
    'Key Client Personnel'?: string;
    'Key Comments'?: string;
    'gst_rates'?: { [key: string]: number };
}

interface RoomData {
    name: string;
    area?: number;
    boq_items?: any[];
    subtotal?: number;
    gst?: number;
    total?: number;
}

interface HeaderRanges {
    left: string;
    middle: string;
    right: string;
}

// ==================== STYLE DEFINITIONS ====================
const STYLES = {
    header_green_fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFA9D08E' }
    } as ExcelJS.Fill,
    header_light_green_fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2EFDA' }
    } as ExcelJS.Fill,
    table_header_blue_fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    } as ExcelJS.Fill,
    boq_category_fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCE4D6' }
    } as ExcelJS.Fill,
    grand_total_fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB9C' }
    } as ExcelJS.Fill,
    commercial_terms_fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
    } as ExcelJS.Fill,
    white_fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
    } as ExcelJS.Fill,
    black_bold_font: { color: { argb: 'FF000000' }, bold: true, name: 'Calibri', size: 11 } as Partial<ExcelJS.Font>,
    white_bold_font: { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri', size: 11 } as Partial<ExcelJS.Font>,
    bold_font: { bold: true, name: 'Calibri', size: 11 } as Partial<ExcelJS.Font>,
    thin_border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    } as ExcelJS.Borders,
    currency_format: '₹#,##0.00' // Default format, will adjust based on currency
};

// ==================== HELPER FUNCTIONS ====================

// Helper to get image dimensions from base64
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (e) => {
      reject(e);
    };
    img.src = base64;
  });
};

async function addImageToCell(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, imageSource: string, cellAddress: string, rowHeight: number) {
    if (!imageSource) return;

    try {
        let buffer: ArrayBuffer;
        let extension: 'png' | 'jpeg' = 'png';

        // Check if it's a data URI (Base64)
        if (imageSource.startsWith('data:image')) {
             const response = await fetch(imageSource);
             const blob = await response.blob();
             buffer = await blob.arrayBuffer();
             if(imageSource.includes('jpeg') || imageSource.includes('jpg')) extension = 'jpeg';
        } else {
             // It's a URL path
             const response = await fetch(imageSource);
             if (!response.ok) return;
             const blob = await response.blob();
             buffer = await blob.arrayBuffer();
        }

        const imageId = workbook.addImage({
            buffer: buffer,
            extension: extension,
        });

        // Calculate dimensions to maintain aspect ratio
        // Default excel row height is roughly 15-20px. We set header rows to 50px each, so total height ~100px.
        // We use pixels for the 'ext' property.
        
        let width = 200; // fallback
        let height = rowHeight;

        try {
           const dims = await getImageDimensions(imageSource);
           const aspectRatio = dims.width / dims.height;
           height = rowHeight;
           width = height * aspectRatio;
        } catch (err) {
           console.warn("Could not calculate image dimensions, using default aspect ratio.");
        }

        const cell = sheet.getCell(cellAddress);
        const col = Number(cell.col) - 1;
        const row = Number(cell.row) - 1;

        sheet.addImage(imageId, {
            tl: { col: col, row: row },
            ext: { width: width, height: height }, 
            editAs: 'oneCell'
        });

    } catch (e) {
        console.warn("Could not add image to Excel:", e);
        const cell = sheet.getCell(cellAddress);
        if(cellAddress === 'A1') {
             cell.value = "Company Logo";
        }
    }
}

async function createSheetHeader(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, branding: BrandingSettings, ranges: HeaderRanges) {
    // Set row heights for the header
    const headerRowHeight = 45;
    sheet.getRow(1).height = headerRowHeight;
    sheet.getRow(2).height = headerRowHeight;
    const totalHeightPx = headerRowHeight * 2 * 1.33; // Approx conversion to pixels for image scaling (Excel points to px)

    // Merge Left Side - Wider area for Primary Logo + Badges
    sheet.mergeCells(ranges.left); 
    
    // Merge Middle - Whitespace
    sheet.mergeCells(ranges.middle);
    
    // Merge Right Side - Wider area for Partner Logos
    sheet.mergeCells(ranges.right); 

    const leftStartCell = ranges.left.split(':')[0];
    const rightStartCell = ranges.right.split(':')[0];

    // Primary Logo (Left)
    if (branding.logoUrl) {
        // slightly smaller height to add padding
        await addImageToCell(workbook, sheet, branding.logoUrl, leftStartCell, 90); 
    } else {
        const cell = sheet.getCell(leftStartCell);
        cell.value = "Company Logo";
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { italic: true, color: { argb: 'FF888888' } };
    }

    // Secondary Logo (Right)
    if (branding.secondaryLogoUrl) {
        // Position it in the top-left of the merged right cell range
        await addImageToCell(workbook, sheet, branding.secondaryLogoUrl, rightStartCell, 90);
    }
}

// ==================== SHEET GENERATORS ====================

async function addVersionControlSheet(workbook: ExcelJS.Workbook, projectDetails: ProjectDetails, branding: BrandingSettings) {
    const sheet = workbook.addWorksheet('Version Control');
    
    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 25;
    sheet.getColumn('D').width = 5;
    sheet.getColumn('E').width = 25;
    sheet.getColumn('F').width = 40;

    // Compact header for A-F width
    await createSheetHeader(workbook, sheet, branding, {
        left: 'A1:B2',
        middle: 'C1:D2',
        right: 'E1:F2'
    });
    
    sheet.views = [{ showGridLines: false }];

    // Version Control Table
    sheet.mergeCells('A3:B3');
    const vcHeader = sheet.getCell('A3');
    vcHeader.value = "Version Control";
    vcHeader.fill = STYLES.header_green_fill;
    vcHeader.font = STYLES.black_bold_font;
    vcHeader.alignment = { horizontal: 'left', vertical: 'middle' };
    vcHeader.border = STYLES.thin_border;
    sheet.getCell('B3').border = STYLES.thin_border;

    const vcData = [
        ["Date of First Draft", new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
        ["Date of Final Draft", ""],
        ["", ""], // Spacer
        ["", ""], // Spacer
        ["Version No.", "1.0"],
        ["Published Date", new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })]
    ];

    vcData.forEach((row, index) => {
        const r = index + 4;
        const cellA = sheet.getCell(`A${r}`);
        const cellB = sheet.getCell(`B${r}`);

        cellA.value = row[0];
        cellA.fill = STYLES.header_light_green_fill;
        cellA.alignment = { vertical: 'middle' };
        cellA.border = STYLES.thin_border;

        cellB.value = row[1];
        cellB.alignment = { vertical: 'middle' };
        cellB.border = STYLES.thin_border;
    });

    // Contact Details Table
    sheet.mergeCells('E3:F3');
    const cdHeader = sheet.getCell('E3');
    cdHeader.value = "Contact Details";
    cdHeader.fill = STYLES.header_green_fill;
    cdHeader.font = STYLES.black_bold_font;
    cdHeader.alignment = { horizontal: 'left', vertical: 'middle' };
    cdHeader.border = STYLES.thin_border;
    sheet.getCell('F3').border = STYLES.thin_border;

    const contactData = [
        ["Design Engineer", projectDetails['Design Engineer'] || ""],
        ["Account Manager", projectDetails['Account Manager'] || ""],
        ["Client Name", projectDetails['Client Name'] || ""],
        ["Key Client Personnel", projectDetails['Key Client Personnel'] || ""],
        ["Location", projectDetails['Location'] || ""],
        ["Key Comments for this version", projectDetails['Key Comments'] || ""]
    ];

    contactData.forEach((row, index) => {
        const r = index + 4;
        const cellE = sheet.getCell(`E${r}`);
        const cellF = sheet.getCell(`F${r}`);

        cellE.value = row[0];
        cellE.fill = STYLES.header_light_green_fill;
        cellE.alignment = { vertical: 'middle' };
        cellE.border = STYLES.thin_border;

        cellF.value = row[1];
        cellF.border = STYLES.thin_border;

        if (row[0] === "Key Comments for this version") {
            sheet.getRow(r).height = 40;
            cellF.alignment = { wrapText: true, vertical: 'top' };
        } else {
            cellF.alignment = { vertical: 'middle' };
        }
    });
}

async function generateBudgetSummarySheet(workbook: ExcelJS.Workbook, roomsData: RoomData[], projectDetails: ProjectDetails, branding: BrandingSettings) {
    const sheet = workbook.addWorksheet('Executive Summary');
    
    // Compact header for A-F width
    await createSheetHeader(workbook, sheet, branding, {
        left: 'A1:B2',
        middle: 'C1:D2',
        right: 'E1:F2'
    });
    
    sheet.views = [{ showGridLines: false }];

    let row = 4;

    // Project Overview
    sheet.mergeCells(`A${row}:F${row}`);
    const header = sheet.getCell(`A${row}`);
    header.value = "PROJECT OVERVIEW";
    header.fill = STYLES.table_header_blue_fill;
    header.font = STYLES.white_bold_font;
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    row += 2;

    const overviewData = [
        ["Project Name", projectDetails['Project Name'] || 'N/A'],
        ["Client", projectDetails['Client Name'] || 'N/A'],
        ["Location", projectDetails['Location'] || 'N/A'],
        ["Project Date", new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })]
    ];

    overviewData.forEach(([label, value]) => {
        sheet.getCell(`A${row}`).value = label;
        sheet.getCell(`A${row}`).font = STYLES.bold_font;
        sheet.mergeCells(`B${row}:F${row}`);
        sheet.getCell(`B${row}`).value = value;
        row += 1;
    });

    row += 2;

    // Budget Summary
    sheet.mergeCells(`A${row}:F${row}`);
    const budgetHeader = sheet.getCell(`A${row}`);
    budgetHeader.value = "BUDGET BREAKDOWN BY SPACE";
    budgetHeader.fill = STYLES.table_header_blue_fill;
    budgetHeader.font = STYLES.white_bold_font;
    budgetHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    row += 1;

    const headers = ['Room Name', 'Area (sqft)', 'Equipment Cost', 'Services', 'Tax', 'Total'];
    headers.forEach((h, i) => {
        const cell = sheet.getCell(row, i + 1);
        cell.value = h;
        cell.fill = STYLES.header_light_green_fill;
        cell.font = STYLES.bold_font;
        cell.border = STYLES.thin_border;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    row += 1;

    let grandEquipment = 0;
    let grandServices = 0;
    let grandTax = 0;
    let grandTotal = 0;

    roomsData.forEach(room => {
        const subtotal = room.subtotal || 0;
        const equipmentCost = round2(subtotal / 1.30); 
        const servicesCost = round2(subtotal - equipmentCost);
        const tax = room.gst || 0;
        const total = room.total || 0;

        grandEquipment += equipmentCost;
        grandServices += servicesCost;
        grandTax += tax;
        grandTotal += total;

        const rowData = [
            room.name || 'Unknown',
            room.area ? round2(room.area) : 0,
            equipmentCost,
            servicesCost,
            tax,
            total
        ];

        rowData.forEach((val, i) => {
            const cell = sheet.getCell(row, i + 1);
            cell.value = val;
            cell.border = STYLES.thin_border;
            if (i >= 2) {
                cell.numFmt = STYLES.currency_format;
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });
        row += 1;
    });

    // Grand Total
    sheet.mergeCells(`A${row}:B${row}`);
    const totalLabel = sheet.getCell(`A${row}`);
    totalLabel.value = "TOTAL PROJECT INVESTMENT";
    totalLabel.font = { ...STYLES.bold_font, size: 12 };
    totalLabel.fill = STYLES.grand_total_fill;
    totalLabel.border = STYLES.thin_border;
    sheet.getCell(`B${row}`).border = STYLES.thin_border;

    const totals = [grandEquipment, grandServices, grandTax, grandTotal];
    totals.forEach((val, i) => {
        const cell = sheet.getCell(row, i + 3);
        cell.value = round2(val);
        cell.numFmt = STYLES.currency_format;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { ...STYLES.bold_font, size: 11 };
        cell.fill = STYLES.grand_total_fill;
        cell.border = STYLES.thin_border;
    });

    sheet.getColumn('A').width = 30;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 18;
    sheet.getColumn('D').width = 18;
    sheet.getColumn('E').width = 18;
    sheet.getColumn('F').width = 20;
}

async function addScopeOfWorkSheet(workbook: ExcelJS.Workbook, branding: BrandingSettings) {
    const sheet = workbook.addWorksheet('Scope of Work');
    
    // Use 5 columns to allow for better logo placement width (A=8, B-E=100 total)
    sheet.getColumn('A').width = 8;
    sheet.getColumn('B').width = 25;
    sheet.getColumn('C').width = 25;
    sheet.getColumn('D').width = 25;
    sheet.getColumn('E').width = 25;

    // Compact header for A-E width
    await createSheetHeader(workbook, sheet, branding, {
        left: 'A1:B2',
        middle: 'C1:C2',
        right: 'D1:E2'
    });

    sheet.views = [{ showGridLines: false }];

    let row = 4;
    
    // Introduction
    sheet.mergeCells(`A${row}:E${row}`);
    const intro = sheet.getCell(`A${row}`);
    intro.value = "Note: This SoW describes the Scope of the Assignment, the Terms, and the Timelines for delivery in order to formalize this assignment. It also intends to share with you the processes and systems that we follow in our engagements with Client. The company undertakes to provide the following services to Client as part of the project.";
    intro.alignment = { wrapText: true, vertical: 'top' };
    intro.font = { italic: true, size: 10 };
    intro.fill = STYLES.header_green_fill;
    sheet.getRow(row).height = 60;
    row += 1;

    // Undertaking Line
    sheet.mergeCells(`A${row}:E${row}`);
    const undertaking = sheet.getCell(`A${row}`);
    undertaking.value = "All Wave AV Systems Pvt Ltd (All Wave AV Systems) undertakes to provide the following services to Client as part of the project.";
    undertaking.border = STYLES.thin_border;
    row += 2;

    // Scope of Work Header
    sheet.mergeCells(`A${row}:E${row}`);
    const title = sheet.getCell(`A${row}`);
    title.value = "Scope of Work";
    title.font = { size: 11, bold: true, color: { argb: 'FF000000' } };
    title.fill = STYLES.boq_category_fill;
    title.alignment = { horizontal: 'left', vertical: 'middle' };
    title.border = STYLES.thin_border;
    sheet.getRow(row).height = 25;
    row += 2;
    
    // Scope of Work Table Headers
    const h1 = sheet.getCell(`A${row}`); h1.value = "Sr. No"; h1.font = STYLES.bold_font; h1.border = STYLES.thin_border;
    
    sheet.mergeCells(`B${row}:E${row}`);
    const h2 = sheet.getCell(`B${row}`); h2.value = "Particulars"; h2.font = STYLES.bold_font; h2.border = STYLES.thin_border;
    row += 1;

    const scopeItems = [
        "Site Coordination and Prerequisites Clearance.",
        "Detailed schematic drawings according to the design.",
        "Conduit layout drawings/equipment layout drawings, showing mounting location.",
        "Laying of all AV Cables.",
        "Termination of cables with respective connectors.",
        "Installation of all AV equipment in rack as per layout.",
        "Configuration of Audio/Video Switcher.",
        "Configuration of DSP mixer.",
        "Touch Panel Design.",
        "System programming as per design requirement."
    ];

    scopeItems.forEach((item, idx) => {
        const cellA = sheet.getCell(`A${row}`);
        cellA.value = idx + 1;
        cellA.alignment = { horizontal: 'left', vertical: 'top' };
        cellA.border = STYLES.thin_border;

        sheet.mergeCells(`B${row}:E${row}`);
        const cellB = sheet.getCell(`B${row}`);
        cellB.value = item;
        cellB.border = STYLES.thin_border;
        cellB.alignment = { vertical: 'middle', wrapText: true };
        row += 1;
    });
    row += 1;

    // Exclusions Header
    sheet.mergeCells(`A${row}:E${row}`);
    const section = sheet.getCell(`A${row}`);
    section.value = "Exclusions and Dependencies";
    section.fill = STYLES.boq_category_fill;
    section.font = STYLES.bold_font;
    section.alignment = { horizontal: 'left', vertical: 'middle' };
    section.border = STYLES.thin_border;
    row += 1;

    sheet.mergeCells(`A${row}:E${row}`);
    const sub = sheet.getCell(`A${row}`);
    sub.value = "The scope of work described in this SoW does not include the following items of work, which need to be arranged by the client on site:";
    sub.border = STYLES.thin_border;
    sub.alignment = { vertical: 'middle' };
    sheet.getRow(row).height = 20;
    row += 1;

    const exclusions = [
        "Civil work like cutting of false ceilings, chipping, etc.",
        "Electrical work like laying of conduits, raceways, and providing stabilised power supply with zero bias between Earth and Neutral to all required locations",
        "Carpentry work like cutouts on furniture, etc.",
        "Connectivity for electric power, LAN, telephone, IP (1 Mbps), and ISDN (1 Mbps) & cable TV points where necessary and provision of power circuit for AV system on the same phase",
        "Ballasts (0 to 10 volts) in case of fluorescent dimming for lights",
        "Shelves for mounting devices (in case the supply of rack isn't in the SOW)",
        "Adequate cooling/ventilation for all equipment racks and cabinets"
    ];

    exclusions.forEach((item, idx) => {
        const cellA = sheet.getCell(`A${row}`);
        cellA.value = idx + 1;
        cellA.alignment = { horizontal: 'left', vertical: 'top' };
        cellA.border = STYLES.thin_border;

        sheet.mergeCells(`B${row}:E${row}`);
        const cellB = sheet.getCell(`B${row}`);
        cellB.value = item;
        cellB.border = STYLES.thin_border;
        cellB.alignment = { wrapText: true, vertical: 'middle' };
        row += 1;
    });
}

async function addProposalSummarySheet(workbook: ExcelJS.Workbook, roomsData: RoomData[], projectDetails: ProjectDetails, branding: BrandingSettings) {
    const sheet = workbook.addWorksheet('Proposal Summary');
    
    // Header for A-G width
    await createSheetHeader(workbook, sheet, branding, {
        left: 'A1:B2',
        middle: 'C1:E2',
        right: 'F1:G2'
    });

    sheet.views = [{ showGridLines: false }];

    const colWidths = { A: 10, B: 50, C: 12, D: 18, E: 18, F: 18, G: 18 };
    Object.entries(colWidths).forEach(([col, width]) => {
        sheet.getColumn(col).width = width;
    });

    let row = 4;
    sheet.mergeCells(`A${row}:G${row}`);
    const title = sheet.getCell(`A${row}`);
    title.value = "Proposal Summary";
    title.font = { size: 11, bold: true, color: { argb: 'FF000000' } };
    title.fill = STYLES.header_light_green_fill;
    title.alignment = { horizontal: 'left', vertical: 'middle' };
    title.border = STYLES.thin_border;
    sheet.getRow(row).height = 25;
    row += 1;

    // Headers Row 1
    const headers1 = ['Sr. No', 'Description', 'Total Qty', 'INR Supply', '', '', ''];
    headers1.forEach((h, i) => {
        if (h) {
            const cell = sheet.getCell(row, i + 1);
            cell.value = h;
            cell.font = STYLES.bold_font;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.border = STYLES.thin_border;
        }
    });
    sheet.mergeCells(`D${row}:G${row}`);
    row += 1;

    // Headers Row 2
    const headers2 = ['', '', '', 'Rate w/o TAX', 'Amount w/o TAX', 'Total TAX Amount', 'Amount with Tax'];
    headers2.forEach((h, i) => {
        const cell = sheet.getCell(row, i + 1);
        cell.value = h;
        cell.font = STYLES.bold_font;
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        cell.border = STYLES.thin_border;
    });
    sheet.getRow(row).height = 30;
    row += 1;

    let grandSubtotal = 0;
    let grandTax = 0;
    let grandTotal = 0;

    roomsData.forEach((room, idx) => {
        const roomSubtotal = room.subtotal || 0;
        const roomTax = room.gst || 0;
        const roomTotal = room.total || 0;

        grandSubtotal += roomSubtotal;
        grandTax += roomTax;
        grandTotal += roomTotal;

        const totalQty = room.boq_items ? room.boq_items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
        const avgRate = totalQty > 0 ? round2(roomSubtotal / totalQty) : roomSubtotal;

        const rowData = [idx + 1, room.name, totalQty, avgRate, roomSubtotal, roomTax, roomTotal];

        rowData.forEach((val, i) => {
            const cell = sheet.getCell(row, i + 1);
            cell.value = val;
            cell.border = STYLES.thin_border;
            cell.fill = STYLES.white_fill;

            if (i >= 3) {
                cell.numFmt = STYLES.currency_format;
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (i === 0 || i === 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
        });
        sheet.getRow(row).height = 20;
        row += 1;
    });
    
    // Commercial Terms
    row += 2;
    sheet.mergeCells(`A${row}:G${row}`);
    const ctHeader = sheet.getCell(`A${row}`);
    ctHeader.value = "Commercial Terms";
    ctHeader.font = { size: 11, bold: true, color: { argb: 'FF000000' } };
    ctHeader.fill = STYLES.header_light_green_fill;
    ctHeader.alignment = { horizontal: 'left', vertical: 'middle' };
    ctHeader.border = STYLES.thin_border;
    for (let c = 2; c <= 7; c++) sheet.getCell(row, c).border = STYLES.thin_border;
    row += 1;

    // Updated with ALL static text from template
    const commercialTerms = [
        ["A. Delivery, Installations & Site Schedule", "", true],
        ["All Wave AV Systems undertake to ensure its best efforts to complete the assignment for Client within the shortest timelines possible.", "", false],
        ["", "", false],
        ["1. Project Schedule & Site Requirements", "", true],
        ["Week 1-3", "", false],
        ["All Wave AV Systems", "Design & Procurement", false],
        ["Client", "Site Preparations", false],
        ["", "", false],
        ["2. Delivery Terms", "", true],
        ["Duty Paid INR- Free delivery at site", "", false],
        ["Direct Import- FOB OR Ex-works of CIF", "", false],
        ["", "", false],
        ["NOTE", "", true],
        ["a. In case of Direct Import quoted price is exclusive of custom duty and clearing charges. In case these are applicable (for Direct Import orders) they are to borne by Client", "", false],
        ["b. Cable quantity shown is notional and will be supplied as per site requirement and would be charged Measurement + 10% which will account for bends curves end termination + wastage.", "", false],
        ["", "", false],
        ["3. Deliveries Procedures:", "", true],
        ["All deliveries will be completed within 6-8 weeks of the receipt of a commercially clear Purchase Order from Client.", "", false],
        ["All Wave AV Systems will provide a Sales Order Acknowledgement detailing the delivery schedule within 3 days of receipt of this Purchase Order.", "", false],
        ["Equipment will be delivered in a phased manner as delivery times for various vendors/products differ. However All Wave AV Systems will make all efforts to complete delivery of all INR items within a max of 3 shipments.", "", false],
        ["Multiple Way bills If required to be given along with the P.O.", "", false],
        ["", "", false],
        ["4. Implementation roles:", "", true],
        ["All Wave AV Systems shall complete all aspects of implementation – including design, procurement, installation, programming and documentation – within 12 weeks of release of receipt of advance payment.", "", false],
        ["Client will ensure that the site is dust-free, ready in all respects and is handed over to All Wave AV Systems within 8 weeks of issue of purchase order so that the above schedule can be met.", "", false],
        ["", "", false],
        ["B] Payment Terms", "", true],
        ["1. Schedule of Payment", "", true],
        ["Item", "", false],
        ["For Equipment and Materials (INR)", "20% Advance with PO", false],
        ["Installation and Commissioning", "Against system installation", false],
        ["", "", false],
        ["Note: Delay in release of advance payment may alter the project schedule and equipment delivery. In the event the project is delayed beyond 12 weeks on account of site delays etc or any circumstance beyond the direct control of All Wave AV Systems, an additional labour charge @ Rs. 8000 + Service Tax per day will apply.", "", false],
        ["", "", false],
        ["C] Validity", "", true],
        ["Offer Validity :- 7 Days", "", false],
        ["", "", false],
        ["D] Placing a Purchase Order", "", true],
        ["a. In case of Duty Paid INR:", "Order should be placed on All Wave AV Systems Pvt. Ltd. 420A Shah & Nahar Industrial Estate, Lower Parel West Mumbai 400013 INDIA", false],
        ["b.  In case of Direct Import Orders on Quantum AV Pte Ltd", "Consolidation of one or more shipments in a 3rd country permissible only if client takes responsibility of local documentation and bears consequent costs – not included in this proposal.", false],
        ["", "Brand-wise delivery period will vary and will depend on the release date provided by the respective manufacturers.", false],
        ["", "PO value for any brand should be minimum US$ 10,000, else an additional transaction / freight cost will be applicable.", false],
        ["", "Customs clearance and DO charges to be borne by client. All local charges (Charges collect fees + DO charges + Break bulk fee + EDI/CMC charges + Cartage KLM. etc) are to be borne by Client.", false],
        ["", "Certificate of origin is not mandatory document for custom clearance, hence will not be provided by us", false],
        ["", "Client to submit relevant exemption certificates pertaining to Customs duty, Octroi & other Levies along with PO (SEZ, STPI, Other)", false],
        ["", "Billing / Delivery address to be mentioned in PO", false],
        ["", "", false],
        ["E] Cable Estimates", "", true],
        ["At this time All Wave AV Systems has provided Client with a provisional estimate for the various types of cabling required during the course of the project. However, this estimate can vary slightly or significantly depending upon the finalized layouts.", "", false],
        ["All Wave AV Systems will invoice Client for the total consumption of cables when the implementation phase has been completed. The cable usage quantity is calculated as follows:", "", false],
        ["Total Chargeable Cable Quantity = Physical measurement of cable distance + 10% additional cable length on account of bends, curves, end termination etc.", "", false],
        ["", "", false],
        ["F] Order Changes", "", true],
        ["All Wave AV Systems appreciates that there may be some changes required by Client to the Scope of Work outlined in this document at a later stage and is committed to meeting these requirements.", "", false],
        ["However, Client recognizes that this may require significant additional resources in terms of materials or time of All Wave AV Systems' specialists and may therefore require an additional scope to be defined and some additional charge.", "", false],
        ["", "", false],
        ["1. Any additions to the Project scope need to be detailed with a Change Order or a separate Scope of Work.", "", false],
        ["2. All Change Orders must be in writing setting forth the details of the modification and any adjustments to the price, delivery schedule, payment schedule, services, and acceptance tests and criteria.", "", false],
        ["", "", false],
        ["G] Restocking / Cancellation Fees:", "", true],
        ["Client recognizes that any cancellation of orders already placed may cause an irrecoverable loss to All Wave AV Systems and therefore may involve extra charges:", "", false],
        ["1. Cancellation may involve a charge of upto 50% re-stocking / cancellation fees + shipping costs and additional charges.", "", false],
        ["", "", false],
        ["H] Warranty", "", true],
        ["All Wave AV Systems is committed to replace or repair any defective part that needs replacement or repair by the reason of defective workmanship or defects, brought to our notice during the warranty period.", "", false],
        ["All Wave AV Systems undertakes to provide Client with:", "", false],
        ["1. A Comprehensive 12 month Warranty on all equipment provided from the date of handover.", "", false],
        ["2. A Limited Period Warranty on certain consumables, which includes Warranty on the Projector Lamp (450 hours of use or 90 days from purchase whichever is earlier) and warranty on other consumables like Filters and Touch Panel Battery (90 days).", "", false],
        ["3. Further extension in warranty can be provided by All Wave AV Systems by way of a separate Maintenance Contract (at an additional cost).", "", false],
        ["", "", false],
        ["However, Client understands that the warranty cannot be applicable in the following situations:", "", false],
        ["1. Power related damage to the system on account of power fluctuations or spikes. The equipment should always be used through a stabilized power supply / online UPS.", "", false],
        ["2. Accident, misuse, neglect, alteration modification or substitution of any component of the equipment.", "", false],
        ["3. Any loss or damage resulting from fire, flood, exposure to weather conditions and any other force majeure/ act of god", "", false]
    ];

    commercialTerms.forEach(([label, value, isHeader]) => {
        if (!label && !value) {
            row += 1;
            return;
        }
        
        if (isHeader) {
            sheet.mergeCells(`A${row}:G${row}`);
             const lCell = sheet.getCell(`A${row}`);
             lCell.value = label;
             lCell.border = STYLES.thin_border;
             lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } }; // Light blue for sub-headers
             lCell.font = { bold: true, color: { argb: 'FF000000' } };
             for (let c = 2; c <= 7; c++) sheet.getCell(row, c).border = STYLES.thin_border;
        } else {
            sheet.mergeCells(`A${row}:C${row}`);
            const lCell = sheet.getCell(`A${row}`);
            lCell.value = label;
            lCell.border = STYLES.thin_border;
            lCell.alignment = { wrapText: true, vertical: 'middle' };
            for (let c = 2; c <= 3; c++) sheet.getCell(row, c).border = STYLES.thin_border;
            
            sheet.mergeCells(`D${row}:G${row}`);
            const vCell = sheet.getCell(`D${row}`);
            vCell.value = value;
            vCell.border = STYLES.thin_border;
            vCell.alignment = { wrapText: true, vertical: 'middle' };
            for (let c = 5; c <= 7; c++) sheet.getCell(row, c).border = STYLES.thin_border;
        }

        row += 1;
    });
}

async function addTermsAndConditionsSheet(workbook: ExcelJS.Workbook, branding: BrandingSettings) {
    const sheet = workbook.addWorksheet('Terms & Conditions');
    
    // Standard compact header for A-F width
    await createSheetHeader(workbook, sheet, branding, {
        left: 'A1:B2',
        middle: 'C1:D2',
        right: 'E1:F2'
    });
    
    sheet.views = [{ showGridLines: false }];
    
    // Set column widths
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(c => sheet.getColumn(c).width = 20);
    sheet.getColumn('A').width = 8;
    sheet.getColumn('B').width = 20;
    
    let row = 4;

    // Storage and Insurance Section
    sheet.mergeCells(`A${row}:F${row}`);
    const storageHeader = sheet.getCell(`A${row}`);
    storageHeader.value = "Storage and Insurance";
    storageHeader.fill = STYLES.boq_category_fill;
    storageHeader.font = { ...STYLES.bold_font, size: 11, color: { argb: 'FF000000' } };
    storageHeader.border = STYLES.thin_border;
    storageHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(row).height = 25;
    row++;

    // Table Header Row
    const srCell = sheet.getCell(`A${row}`);
    srCell.value = "Sr. No";
    srCell.font = STYLES.bold_font;
    srCell.border = STYLES.thin_border;
    srCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells(`B${row}:F${row}`);
    const partCell = sheet.getCell(`B${row}`);
    partCell.value = "Particulars";
    partCell.font = STYLES.bold_font;
    partCell.border = STYLES.thin_border;
    partCell.alignment = { vertical: 'middle', horizontal: 'left' };
    row++;

    // Storage and Insurance Data
    const storageItems = [
        ["", "Client accepts that the safety of the materials on site cannot be assured by All Wave AV Systems and undertakes to:-"],
        ["1", "Provide storage space for materials in a secure, clean, termite free and dry space. This is essential to protect the equipment during the implementation stage."],
        ["2", "Organize Insurance (against theft, loss or damage by third party) of materials at site."],
        ["3", "During the period of installation, any shortage of material due to pilferage, misplacement etc. at site would be in client's account."],
        ["4", "Further, if due to storage at site / warehouse for prolonged periods, refurbishment of the equipment is needed due to natural aging, the same will be in client's account."]
    ];

    storageItems.forEach(([srNo, text]) => {
        const cellA = sheet.getCell(`A${row}`);
        cellA.value = srNo;
        cellA.border = STYLES.thin_border;
        cellA.alignment = { vertical: 'top', horizontal: 'center' };

        sheet.mergeCells(`B${row}:F${row}`);
        const cellB = sheet.getCell(`B${row}`);
        cellB.value = text;
        cellB.border = STYLES.thin_border;
        cellB.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        const textLength = text ? text.toString().length : 0;
        const estimatedHeight = Math.ceil(textLength / 100) * 15 + 15; 
        sheet.getRow(row).height = Math.max(20, estimatedHeight);

        row++;
    });

    row++; // Spacer

    // Project Commissioning Section
    sheet.mergeCells(`A${row}:F${row}`);
    const commissioningHeader = sheet.getCell(`A${row}`);
    commissioningHeader.value = "Project Commissioning";
    commissioningHeader.fill = STYLES.boq_category_fill;
    commissioningHeader.font = { ...STYLES.bold_font, size: 11, color: { argb: 'FF000000' } };
    commissioningHeader.border = STYLES.thin_border;
    commissioningHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(row).height = 25;
    row++;

    const commissioningHeader2 = sheet.getCell(`A${row}`);
    commissioningHeader2.value = "Other Items";
    sheet.mergeCells(`A${row}:F${row}`);
    commissioningHeader2.border = STYLES.thin_border;
    row++;

    sheet.mergeCells(`A${row}:F${row}`);
    const commissioningDesc = sheet.getCell(`A${row}`);
    commissioningDesc.value = "This section explains the procedures that will be followed post implementation – when commissioning and handing over the site to Client.";
    commissioningDesc.border = STYLES.thin_border;
    commissioningDesc.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sheet.getRow(row).height = 25;
    row++;

    // Table Header Row for ATP
    const atpSrCell = sheet.getCell(`A${row}`);
    atpSrCell.value = "Sr. No";
    atpSrCell.font = STYLES.bold_font;
    atpSrCell.border = STYLES.thin_border;
    atpSrCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells(`B${row}:F${row}`);
    const atpPartCell = sheet.getCell(`B${row}`);
    atpPartCell.value = "Particulars";
    atpPartCell.font = STYLES.bold_font;
    atpPartCell.border = STYLES.thin_border;
    atpPartCell.alignment = { vertical: 'middle', horizontal: 'left' };
    row++;

    // ATP Data
    const atpItems = [
        ["1", "Acceptance Test Procedures (ATP)"],
        ["1a", "This will be conducted by All Wave AV Systems along with the Client team as part of the System Handover and follows standard ATP procedures established by All Wave AV Systems."],
        ["1b", "Client to authorize one person who would be part of this testing and will sign- off the ATP report / Handover documents."],
        ["1c", "The features and functionalities that are part of this specific project SOW only will form a part of this ATP."],
        ["1d", "Any deviation/additional testing will be conducted, provided the same is in line with standards and after mutual discussion."],
        ["1e", "ATP and Handover documents to be signed within 3 days of project completion, including resolution of all snags. In case a certain area / room has an outstanding snag, Client to sign-off on the other working area's so the project can go live."],
        ["1f", "In the event that the ATP and Handover documents are not signed within 7 days of project completion, including resolution of all snags, the handover will be deemed completed and warranty period will automatically commence within 7 days."],
        ["2", "Project Documentation"],
        ["2a", "All Wave AV Systems will submit comprehensive site documentation containing As-Built Drawings, System Schematics, User Manual and support / escalation related information (1 set hardcopy)"],
        ["2b", "All Wave AV Systems may refer to Client as our Client and describe the project undertaken in communication initiatives for Clients and/or prospects."],
        ["3", "System Configuration Changes"],
        ["3a", "Minor Programming changes can be made by the All Wave AV Systems team for up to 30 days after handover. However rewiring and equipment changes may entail an additional charge."]
    ];

    atpItems.forEach(([srNo, text]) => {
        const cellA = sheet.getCell(`A${row}`);
        cellA.value = srNo;
        cellA.border = STYLES.thin_border;
        cellA.alignment = { vertical: 'top', horizontal: 'center' };

        sheet.mergeCells(`B${row}:F${row}`);
        const cellB = sheet.getCell(`B${row}`);
        cellB.value = text;
        cellB.border = STYLES.thin_border;
        cellB.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        const textLength = text ? text.toString().length : 0;
        const estimatedHeight = Math.ceil(textLength / 100) * 15 + 15; 
        sheet.getRow(row).height = Math.max(20, estimatedHeight);

        row++;
    });

    row++; // Spacer

    // Training Section
    sheet.mergeCells(`A${row}:F${row}`);
    const trainingHeader = sheet.getCell(`A${row}`);
    trainingHeader.value = "Training";
    trainingHeader.fill = STYLES.boq_category_fill;
    trainingHeader.font = { ...STYLES.bold_font, size: 11, color: { argb: 'FF000000' } };
    trainingHeader.border = STYLES.thin_border;
    trainingHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(row).height = 25;
    row++;

    sheet.mergeCells(`A${row}:F${row}`);
    const trainingDesc = sheet.getCell(`A${row}`);
    trainingDesc.value = "All Wave AV Systems will provide various stakeholders at Client with the training necessary to operate and maintain the equipment and facilities provided on completion of the implementation. The training stage will cover:";
    trainingDesc.border = STYLES.thin_border;
    trainingDesc.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sheet.getRow(row).height = 30;
    row++;

    // Table Header Row for Training
    const trainSrCell = sheet.getCell(`A${row}`);
    trainSrCell.value = "Sr. No";
    trainSrCell.font = STYLES.bold_font;
    trainSrCell.border = STYLES.thin_border;
    trainSrCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells(`B${row}:F${row}`);
    const trainPartCell = sheet.getCell(`B${row}`);
    trainPartCell.value = "Particulars";
    trainPartCell.font = STYLES.bold_font;
    trainPartCell.border = STYLES.thin_border;
    trainPartCell.alignment = { vertical: 'middle', horizontal: 'left' };
    row++;

    // Training Data
    const trainingItems = [
        ["1", "User Training on the features, functions and usage of the installed AV system"],
        ["2", "Maintenance Training for the appropriate personnel on the first level of maintenance required."],
        ["3", "Sign-off from Client will take place on completion of the above-mentioned modules."]
    ];

    trainingItems.forEach(([srNo, text]) => {
        const cellA = sheet.getCell(`A${row}`);
        cellA.value = srNo;
        cellA.border = STYLES.thin_border;
        cellA.alignment = { vertical: 'top', horizontal: 'center' };

        sheet.mergeCells(`B${row}:F${row}`);
        const cellB = sheet.getCell(`B${row}`);
        cellB.value = text;
        cellB.border = STYLES.thin_border;
        cellB.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        const textLength = text ? text.toString().length : 0;
        const estimatedHeight = Math.ceil(textLength / 100) * 15 + 15; 
        sheet.getRow(row).height = Math.max(20, estimatedHeight);

        row++;
    });

    row++; // Spacer

    // Other Items Section
    sheet.mergeCells(`A${row}:F${row}`);
    const otherHeader = sheet.getCell(`A${row}`);
    otherHeader.value = "Other Items";
    otherHeader.fill = STYLES.boq_category_fill;
    otherHeader.font = { ...STYLES.bold_font, size: 11, color: { argb: 'FF000000' } };
    otherHeader.border = STYLES.thin_border;
    otherHeader.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(row).height = 25;
    row++;

    sheet.mergeCells(`A${row}:F${row}`);
    const otherDesc = sheet.getCell(`A${row}`);
    otherDesc.value = "All Wave AV Systems is dependent on timely response and cooperation from the team at Client in order to meet the schedule outlined in this document. Therefore Client undertakes to provide All Wave AV Systems with:";
    otherDesc.border = STYLES.thin_border;
    otherDesc.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sheet.getRow(row).height = 30;
    row++;

    // Table Header Row for Other Items
    const otherSrCell = sheet.getCell(`A${row}`);
    otherSrCell.value = "Sr. No";
    otherSrCell.font = STYLES.bold_font;
    otherSrCell.border = STYLES.thin_border;
    otherSrCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.mergeCells(`B${row}:F${row}`);
    const otherPartCell = sheet.getCell(`B${row}`);
    otherPartCell.value = "Particulars";
    otherPartCell.font = STYLES.bold_font;
    otherPartCell.border = STYLES.thin_border;
    otherPartCell.alignment = { vertical: 'middle', horizontal: 'left' };
    row++;

    // Other Items Data
    const otherItems = [
        ["1", "The necessary co-operation needed from the other site contractors to ensure smooth and timely functioning of work."],
        ["2", "Prompt and adequate responses to All Wave AV Systems' requests for information / approvals related to the services to be performed under this SOW."],
        ["3", "In case the site interior work has been completed around the time the PO is released on All Wave AV Systems, Client to ensure that necessary and timely co-operation is extended by all concerned vendors to facilitate smooth and quick completion of the site by All Wave AV Systems."],
        ["3a", "In the event that All Wave AV Systems has made a request and Client has not responded in reasonable time with the requested information, the All Wave AV Systems Project Manager may issue a 'Final 30-Day Project Notice' ('Final Notice') to Client."],
        ["3b", "If Client does not respond as requested to the Final Notice, All Wave AV Systems shall be relieved of any further obligations which have not been completed under the SOW."],
        ["3c", "All costs and services fees associated with the SOW shall be considered earned in full as of the expiration of the thirty (30) day period."],
        ["3d", "Any services requested by Client following the expiration of the thirty (30) day period will require Client and All Wave AV Systems to execute a new SOW and Client would be responsible for any additional services fees contemplated there under, even if listed in the original SOW."]
    ];

    otherItems.forEach(([srNo, text]) => {
        const cellA = sheet.getCell(`A${row}`);
        cellA.value = srNo;
        cellA.border = STYLES.thin_border;
        cellA.alignment = { vertical: 'top', horizontal: 'center' };

        sheet.mergeCells(`B${row}:F${row}`);
        const cellB = sheet.getCell(`B${row}`);
        cellB.value = text;
        cellB.border = STYLES.thin_border;
        cellB.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        const textLength = text ? text.toString().length : 0;
        const estimatedHeight = Math.ceil(textLength / 100) * 15 + 15; 
        sheet.getRow(row).height = Math.max(20, estimatedHeight);

        row++;
    });
}

async function populateRoomBoqSheet(workbook: ExcelJS.Workbook, room: RoomData, styles: any, usdToInrRate: number, gstRates: any, branding: BrandingSettings, viewMode: ViewMode) {
    const safeName = room.name.replace(/[\\/*?:"<>|]/g, '').substring(0, 25);
    const sheet = workbook.addWorksheet(`BOQ - ${safeName}`);
    
    // Large header for BOQ (A-O width)
    await createSheetHeader(workbook, sheet, branding, {
        left: 'A1:D2',
        middle: 'E1:L2',
        right: 'M1:P2'
    });

    // Room Info
    const infoData = [
        ["Room Name / Room Type", room.name],
        ["Floor", "-"],
        ["Number of Seats", "-"],
        ["Number of Rooms", "-"]
    ];

    infoData.forEach((row, i) => {
        const r = i + 3;
        sheet.getCell(`A${r}`).value = row[0];
        sheet.getCell(`A${r}`).font = STYLES.bold_font;
        sheet.getCell(`A${r}`).fill = STYLES.boq_category_fill;
        sheet.mergeCells(`B${r}:C${r}`);
        sheet.getCell(`B${r}`).value = row[1];
        ['A', 'B', 'C'].forEach(c => sheet.getCell(`${c}${r}`).border = STYLES.thin_border);
    });
    
    // Spacer row
    sheet.addRow([]); 
    
    // Headers
    const headers1 = [
        'Sr. No.', 'Category', 'Description & Specifications', 'Make', 'Model No.', 'Qty.',
        'Unit Rate (INR)', 'Total', 'SGST\n( In Maharashtra)', '',
        'CGST\n( In Maharashtra)', '', 'Total (TAX)', 'Remarks / Key Benefits', 'Reference Image'
    ];
    const headers2 = [
        '', '', '', '', '', '', '', '',
        'Rate', 'Amt', 'Rate', 'Amt', '', '', ''
    ];
    
    // Adjust column widths for BOQ
    sheet.getColumn('A').width = 6;  // Sr No
    sheet.getColumn('B').width = 20; // Category
    sheet.getColumn('C').width = 50; // Description & Specs
    sheet.getColumn('D').width = 15; // Make
    sheet.getColumn('E').width = 15; // Model
    sheet.getColumn('F').width = 8;  // Qty
    sheet.getColumn('G').width = 15; // Unit Rate
    sheet.getColumn('H').width = 15; // Total
    sheet.getColumn('I').width = 8;  // SGST Rate
    sheet.getColumn('J').width = 12; // SGST Amt
    sheet.getColumn('K').width = 8;  // CGST Rate
    sheet.getColumn('L').width = 12; // CGST Amt
    sheet.getColumn('M').width = 15; // Total Tax
    sheet.getColumn('N').width = 35; // Remarks
    sheet.getColumn('O').width = 25; // Image
    
    const headerStartRow = sheet.rowCount + 1;
    sheet.addRow(headers1);
    sheet.addRow(headers2);

    sheet.mergeCells(`I${headerStartRow}:J${headerStartRow}`);
    sheet.mergeCells(`K${headerStartRow}:L${headerStartRow}`);

    for (let r = headerStartRow; r <= headerStartRow + 1; r++) {
        sheet.getRow(r).eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCFE2F3' } }; // Light blue
            cell.font = { bold: true, size: 9 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = STYLES.thin_border;
        });
    }

    let itemSNo = 1;
    const categoryLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const renderItemRow = (item: any) => {
        const unitPrice = round2(item.price);
        const subtotal = round2(unitPrice * (item.quantity || 1));
        const gstRate = item.gst_rate || 18;
        const sgstRate = gstRate / 2;
        const cgstRate = gstRate / 2;
        const sgstAmount = round2(subtotal * (sgstRate / 100));
        const cgstAmount = round2(subtotal * (cgstRate / 100));
        const totalTax = round2(sgstAmount + cgstAmount);
        
        const rowData = [
            itemSNo, 
            item.category || 'General',  // Column B: Category
            item.name || '',             // Column C: Description/Specifications
            item.brand || 'Unknown', 
            item.model_number || 'N/A',
            item.quantity || 1, 
            unitPrice, 
            subtotal, 
            `${sgstRate}%`, sgstAmount, 
            `${cgstRate}%`, cgstAmount,
            totalTax, 
            item.top_3_reasons || '',   // Column N: Key Remarks
            ''  // Image
        ];

        const row = sheet.addRow(rowData);
        row.height = 50; // Increased height for description and remarks

        row.eachCell((cell, colNumber) => {
            cell.border = STYLES.thin_border;
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.font = { size: 9 };
            
            if (colNumber >= 7 && colNumber <= 13 && colNumber !== 9 && colNumber !== 11) {
                cell.numFmt = STYLES.currency_format;
            }
             if (colNumber === 1 || colNumber === 6) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });

        itemSNo++;
    };

    if (viewMode === 'grouped') {
         const defaultCategoryOrder = [
            "Display", "Video Conferencing & Cameras", "Audio - Microphones", "Audio - DSP & Amplification", 
            "Audio - Speakers", "Video Distribution & Switching", "Control System & Environmental", 
            "Cabling & Infrastructure", "Mounts & Racks", "Acoustic Treatment", "Accessories & Services"
        ];

        const groupedItems: { [key: string]: any[] } = {};
        (room.boq_items || []).forEach(item => {
            const cat = item.category || 'General AV';
            if (!groupedItems[cat]) groupedItems[cat] = [];
            groupedItems[cat].push(item);
        });

        const foundCategories = Object.keys(groupedItems);
        const orderedCategories = [
            ...defaultCategoryOrder.filter(c => foundCategories.includes(c)),
            ...foundCategories.filter(c => !defaultCategoryOrder.includes(c)).sort()
        ];

        orderedCategories.forEach((category, i) => {
            const items = groupedItems[category];
            sheet.addRow([categoryLetters[i] || '', category]);
            const catRow = sheet.lastRow!;
            sheet.mergeCells(`B${catRow.number}:O${catRow.number}`);
            catRow.eachCell(cell => {
                cell.fill = STYLES.boq_category_fill;
                cell.font = { bold: true, size: 9 };
                cell.border = STYLES.thin_border;
            });
            items.forEach(renderItemRow);
        });

    } else {
        (room.boq_items || []).forEach(renderItemRow);
    }
}

// ==================== MAIN FUNCTION ====================

export const exportToXlsx = async (
    rooms: Room[],
    clientDetails: ClientDetails,
    margin: number,
    branding: BrandingSettings,
    selectedCurrency: Currency,
    viewMode: ViewMode,
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = branding.companyInfo.name || 'GenBOQ User';
    workbook.created = new Date();

    // Fetch exchange rates
    const rates = await getExchangeRates();
    const usdToInrRate = selectedCurrency === 'INR' ? (rates['INR'] || 83.5) : 1;
    
    STYLES.currency_format = selectedCurrency === 'INR' ? '₹#,##0.00' : '$#,##0.00';

    const projectDetails: ProjectDetails = {
        'Project Name': clientDetails.projectName,
        'Client Name': clientDetails.clientName,
        'Location': clientDetails.location,
        'Design Engineer': clientDetails.designEngineer,
        'Account Manager': clientDetails.accountManager,
        'Key Client Personnel': clientDetails.keyClientPersonnel,
        'Key Comments': clientDetails.keyComments,
        'gst_rates': { 'Electronics': 18, 'Services': 18 }
    };

    const roomsData: RoomData[] = rooms.map(room => {
        let subtotalHardware = 0;
        let gstElectronics = 0;
        let subtotalServices = 0;
        let gstServices = 0;

        const length = Number(room.answers.roomLength) || 0;
        const width = Number(room.answers.roomWidth) || 0;
        const calculatedArea = length * width;

        const mappedItems = (room.boq || []).map(item => {
            const unitPriceConverted = item.unitPrice * usdToInrRate;
            const itemMargin = item.margin !== undefined ? item.margin : margin;
            const marginMultiplier = 1 + (itemMargin / 100);
            const finalUnitPrice = round2(unitPriceConverted * marginMultiplier);

            const itemTotal = round2(finalUnitPrice * item.quantity);
            subtotalHardware += itemTotal;
            
            const itemGst = round2(itemTotal * 0.18);
            gstElectronics += itemGst;

            return {
                name: item.itemDescription,
                brand: item.brand,
                model_number: item.model,
                quantity: item.quantity,
                price: finalUnitPrice, 
                top_3_reasons: item.keyRemarks ? item.keyRemarks : "Standard requirement",
                category: item.category,
                gst_rate: 18,
                warranty: "1 Year"
            };
        });

        subtotalServices = round2(subtotalHardware * 0.30);
        gstServices = round2(subtotalServices * 0.18);

        const totalWithoutGst = round2(subtotalHardware + subtotalServices);
        const totalGst = round2(gstElectronics + gstServices);

        return {
            name: room.name,
            area: calculatedArea,
            boq_items: mappedItems,
            subtotal: totalWithoutGst,
            gst: totalGst,
            total: round2(totalWithoutGst + totalGst)
        };
    });

    await addVersionControlSheet(workbook, projectDetails, branding);
    await generateBudgetSummarySheet(workbook, roomsData, projectDetails, branding);
    await addScopeOfWorkSheet(workbook, branding);
    await addProposalSummarySheet(workbook, roomsData, projectDetails, branding);
    await addTermsAndConditionsSheet(workbook, branding);
    
    for (const room of roomsData) {
        if (room.boq_items && room.boq_items.length > 0) {
            await populateRoomBoqSheet(workbook, room, STYLES, 1, projectDetails.gst_rates || {}, branding, viewMode);
        }
    }

    const defaultSheet = workbook.getWorksheet('Sheet 1');
    if (defaultSheet) workbook.removeWorksheet(defaultSheet.id);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Proposal_${projectDetails['Project Name'] || 'Draft'}.xlsx`);
};