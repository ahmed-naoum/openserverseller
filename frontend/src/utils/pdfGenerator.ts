import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const generateInvoicePDF = (invoiceDetails: any) => {
  const doc = new jsPDF();
  
  // Custom Fonts & Colors setup
  const primaryColor = [139, 92, 246] as [number, number, number]; // Violet 500
  const textColor = [31, 41, 55] as [number, number, number]; // Gray 800
  const lightGray = [156, 163, 175] as [number, number, number]; // Gray 400

  // 1. Header Section
  doc.setFontSize(28);
  doc.setTextColor(...primaryColor);
  doc.text('FACTURE', 14, 25);
  
  // Invoice Number
  doc.setFontSize(10);
  doc.setTextColor(...lightGray);
  doc.text('N° de facture', 14, 35);
  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.text(invoiceDetails.invoiceNumber, 14, 41);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(...lightGray);
  doc.text('Date', 14, 50);
  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  const formattedDate = format(new Date(invoiceDetails.createdAt), 'dd MMMM yyyy', { locale: fr });
  doc.text(formattedDate, 14, 56);

  // 2. Company Info (Right aligned)
  const pageWidth = doc.internal.pageSize.width;
  doc.setFontSize(16);
  doc.setTextColor(...textColor);
  doc.text('SILACOD', pageWidth - 14, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(...lightGray);
  doc.text('Plateforme de dropshipping', pageWidth - 14, 32, { align: 'right' });
  doc.text('contact@silacod.ma', pageWidth - 14, 38, { align: 'right' });

  // 3. User Info (Billed To)
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('FACTURÉ À:', 14, 75);
  
  doc.setFontSize(14);
  doc.setTextColor(...textColor);
  doc.text(invoiceDetails.userFullName || 'Utilisateur', 14, 83);
  doc.setFontSize(10);
  doc.setTextColor(...lightGray);
  if (invoiceDetails.user?.email) {
    doc.text(invoiceDetails.user.email, 14, 89);
  }

  // 4. Table of Leads/Colis
  const tableData = (invoiceDetails.leads || []).map((lead: any) => {
    const amount = lead.order?.totalAmountMad || 0;
    
    const packageName = lead.order?.coliatyPackageCode || lead.order?.orderNumber || 'N/A';
    
    const clientInfo = [
      lead.order?.customerName || lead.fullName,
      lead.order?.customerPhone || lead.phone
    ].filter(Boolean).join('\n');

    const destinationInfo = [
      lead.order?.customerCity || lead.city,
      lead.order?.customerAddress || lead.address
    ].filter(Boolean).join('\n') || '-';

    const productName = lead.order?.items?.[0]?.product?.nameFr || lead.referralLink?.product?.nameFr || 'Produit';

    return [
      packageName,
      clientInfo,
      destinationInfo,
      productName,
      `${Number(amount).toFixed(2)} MAD`
    ];
  });

  autoTable(doc, {
    startY: 105,
    head: [['Colis', 'Client', 'Destination', 'Produit', 'Montant']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [249, 250, 251], // Gray 50
      textColor: [107, 114, 128], // Gray 500
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 10,
    },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' } // Montant right aligned
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // Gray 50
    },
    margin: { left: 14, right: 14 }
  });

  // 5. Total Section
  let finalY = (doc as any).lastAutoTable.finalY || 150;
  
  const numLeads = invoiceDetails.leads?.length || 0;
  const grossAmount = (invoiceDetails.leads || []).reduce((sum: number, lead: any) => sum + (lead.order?.totalAmountMad || 0), 0);
  const deliveryCost = 57 * numLeads;
  const profit = grossAmount - deliveryCost;
  const platformFee = profit > 0 ? profit * 0.13 : 0;

  doc.setDrawColor(229, 231, 235); // Gray 200
  doc.line(pageWidth - 90, finalY + 10, pageWidth - 14, finalY + 10);
  
  doc.setFontSize(10);
  
  finalY += 18;
  doc.setTextColor(...lightGray);
  doc.text('Sous-total brut:', pageWidth - 90, finalY);
  doc.setTextColor(...textColor);
  doc.text(`${grossAmount.toFixed(2)} MAD`, pageWidth - 14, finalY, { align: 'right' });

  finalY += 8;
  doc.setTextColor(...lightGray);
  doc.text(`Frais de livraison (${numLeads}):`, pageWidth - 90, finalY);
  doc.setTextColor(239, 68, 68); // Red
  doc.text(`-${deliveryCost.toFixed(2)} MAD`, pageWidth - 14, finalY, { align: 'right' });

  finalY += 8;
  doc.setTextColor(...lightGray);
  doc.text(`Frais de plateforme (13%):`, pageWidth - 90, finalY);
  doc.setTextColor(239, 68, 68); // Red
  doc.text(`-${platformFee.toFixed(2)} MAD`, pageWidth - 14, finalY, { align: 'right' });

  finalY += 8;
  doc.setDrawColor(229, 231, 235);
  doc.line(pageWidth - 90, finalY, pageWidth - 14, finalY);
  
  finalY += 10;
  doc.setFontSize(12);
  doc.setTextColor(...lightGray);
  doc.text('TOTAL NET:', pageWidth - 90, finalY);
  
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text(`${Number(invoiceDetails.totalAmountMad).toFixed(2)} MAD`, pageWidth - 14, finalY, { align: 'right' });

  // 6. Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.text('Merci pour votre confiance.', pageWidth / 2, pageHeight - 15, { align: 'center' });

  // Output
  doc.save(`${invoiceDetails.invoiceNumber}.pdf`);
};
