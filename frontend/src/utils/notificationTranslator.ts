export function translateNotification(
  notif: { type: string; title: string; body: string },
  t: (key: string, namespace: 'notifications', fallback?: string) => string
): { title: string; body: string } {
  const { type, title: originalTitle, body: originalBody } = notif;

  // Helper to replace {placeholder} in translation strings
  const formatTranslation = (str: string, params: Record<string, string>) => {
    let result = str;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  };

  try {
    if (type === 'PRODUCT_CLAIM_STATUS') {
      if (originalTitle.includes('approuvé')) {
        const match = originalBody.match(/pour le produit "(.*?)"/);
        const productName = match ? match[1] : '';
        return {
          title: t('type_claim_approved_title', 'notifications', originalTitle),
          body: formatTranslation(t('type_claim_approved_body', 'notifications', originalBody), { productName })
        };
      }
      if (originalTitle.includes('refusée')) {
        const match = originalBody.match(/pour le produit "(.*?)"/);
        const productName = match ? match[1] : '';
        return {
          title: t('type_claim_rejected_title', 'notifications', originalTitle),
          body: formatTranslation(t('type_claim_rejected_body', 'notifications', originalBody), { productName })
        };
      }
      if (originalTitle.includes('soumise')) {
        const match = originalBody.match(/pour le produit "(.*?)"/);
        const productName = match ? match[1] : '';
        return {
          title: t('type_claim_submitted_title', 'notifications', originalTitle),
          body: formatTranslation(t('type_claim_submitted_body', 'notifications', originalBody), { productName })
        };
      }
    }

    if (type === 'REFERRAL_LINK_STATUS') {
      const pMatch = originalBody.match(/pour le produit "(.*?)"/);
      const productName = pMatch ? pMatch[1] : '';
      const lMatch = originalBody.match(/est maintenant\s*:\s*(.*?)(?:\.|$)/);
      const originalLabel = lMatch ? lMatch[1].trim() : '';

      let labelKey = '';
      if (originalLabel === 'En construction') labelKey = 'status_label_building';
      else if (originalLabel === 'Actif') labelKey = 'status_label_active';
      else if (originalLabel === 'Inactif') labelKey = 'status_label_inactive';
      else if (originalLabel === 'Suspendu') labelKey = 'status_label_suspended';

      const label = labelKey ? t(labelKey, 'notifications', originalLabel) : originalLabel;

      return {
        title: t('type_link_status_title', 'notifications', originalTitle),
        body: formatTranslation(t('type_link_status_body', 'notifications', originalBody), { productName, label })
      };
    }

    if (type === 'REFERRAL_LINK_CLICKS') {
      const match = originalBody.match(/parrainage \((.*?)\)/);
      const code = match ? match[1] : '';
      return {
        title: t('type_link_clicks_title', 'notifications', originalTitle),
        body: formatTranslation(t('type_link_clicks_body', 'notifications', originalBody), { code })
      };
    }

    if (type === 'PAYOUT_REQUEST_STATUS') {
      const amountMatch = originalBody.match(/(?:retrait de|montant de)\s+([0-9.]+)\s+MAD/);
      const amount = amountMatch ? amountMatch[1] : '';
      const idMatch = originalBody.match(/\(#([0-9]+)\)/);
      const id = idMatch ? idMatch[1] : '';

      if (originalTitle.includes('soumise')) {
        return {
          title: t('type_payout_submitted_title', 'notifications', originalTitle),
          body: formatTranslation(t('type_payout_submitted_body', 'notifications', originalBody), { amount, id })
        };
      }
      if (originalTitle.includes('effectué') || originalTitle.includes('payée')) {
        return {
          title: t('type_payout_completed_title', 'notifications', originalTitle),
          body: formatTranslation(t('type_payout_completed_body', 'notifications', originalBody), { amount, id })
        };
      }
      if (originalTitle.includes('rejeté')) {
        return {
          title: t('type_payout_rejected_title', 'notifications', originalTitle),
          body: formatTranslation(t('type_payout_rejected_body', 'notifications', originalBody), { amount, id })
        };
      }
      if (originalTitle.includes('attente') || originalTitle.includes('cours')) {
        return {
          title: t('type_payout_pending_title', 'notifications', originalTitle),
          body: formatTranslation(t('type_payout_pending_body', 'notifications', originalBody), { amount, id })
        };
      }
    }

    if (type === 'NEW_LEAD') {
      const nameMatch = originalBody.match(/nouveau lead de (.*?)\s+\(/);
      const fullName = nameMatch ? nameMatch[1] : '';
      const cityMatch = originalBody.match(/\((.*?)\)\s+pour le produit/);
      const city = cityMatch ? cityMatch[1] : '';
      const pMatch = originalBody.match(/pour le produit "(.*?)"/);
      const productName = pMatch ? pMatch[1] : '';

      return {
        title: t('type_new_lead_title', 'notifications', originalTitle),
        body: formatTranslation(t('type_new_lead_body', 'notifications', originalBody), { fullName, city, productName })
      };
    }

    if (type === 'LEAD_STATUS_CHANGED') {
      const nameMatch = originalBody.match(/Le lead de (.*?)\s+pour le produit/);
      const fullName = nameMatch ? nameMatch[1] : '';
      const pMatch = originalBody.match(/pour le produit "(.*?)"/);
      const productName = pMatch ? pMatch[1] : '';
      const lMatch = originalBody.match(/est maintenant\s+(.*?)(?:\.|$)/);
      const originalLabel = lMatch ? lMatch[1].trim() : '';

      let labelKey = '';
      if (originalLabel === 'CONFIRMÉ') labelKey = 'lead_label_confirmed';
      else if (originalLabel === 'LIVRÉ') labelKey = 'lead_label_delivered';
      else if (originalLabel === 'ANNULÉ (PRIX)') labelKey = 'lead_label_cancel_price';
      else if (originalLabel === 'RETOURNÉ') labelKey = 'lead_label_returned';

      const label = labelKey ? t(labelKey, 'notifications', originalLabel) : originalLabel;

      let titleKey = 'type_lead_status_changed_title';
      if (originalTitle.includes('Livraison')) {
        titleKey = 'type_lead_status_changed_delivery_title';
      }

      return {
        title: formatTranslation(t(titleKey, 'notifications', originalTitle), { label }),
        body: formatTranslation(t('type_lead_status_changed_body', 'notifications', originalBody), { fullName, productName, label })
      };
    }
  } catch (err) {
    console.error('Failed to translate notification message:', err);
  }

  // Fallback to original
  return { title: originalTitle, body: originalBody };
}
