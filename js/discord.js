/* ═══════════════════════════════════════════
   Discord Webhook Module — BulletFarm Shop
   Send order notifications + status updates
   ═══════════════════════════════════════════ */

/**
 * Get the Discord webhook URL from shop settings
 */
function getWebhookUrl() {
    const settings = window.__shopSettings || {};
    return settings.discordWebhook || '';
}

/**
 * Format resources for Discord embed
 */
function formatResourcesForDiscord(items) {
    const totals = new Map();
    for (const item of items) {
        const resources = item.resources || [];
        const qty = item.qty || 1;
        const mult = item.variantMultiplier || 1;
        for (const r of resources) {
            const name = String(r.name || '').trim();
            if (!name) continue;
            const amount = (Number(r.amount) || 0) * qty * mult;
            totals.set(name, (totals.get(name) || 0) + amount);
        }
    }

    if (totals.size === 0) return 'Keine Ressourcen';
    return Array.from(totals.entries())
        .map(([name, amount]) => `**${name}:** ${Math.round(amount).toLocaleString('de-DE')}`)
        .join('\n');
}

/**
 * Build a Discord embed for a new order
 */
function buildNewOrderEmbed(order) {
    const items = order.items || [];
    const customer = order.customer || {};
    const name = customer.name || 'Unbekannt';
    const contact = customer.phone || customer.discord || '—';

    const itemLines = items.map(i => {
        const variant = (i.variantName && i.variantName !== 'Standard') ? ` (${i.variantName})` : '';
        return `• **${i.name || 'Produkt'}**${variant} × ${i.qty}`;
    }).join('\n');

    return {
        embeds: [{
            title: '🛒 Neue Bestellung',
            color: 0x60A5FA, // primary blue
            fields: [
                {
                    name: '📋 Bestellung',
                    value: `\`${String(order.id || '').slice(0, 8)}\``,
                    inline: true
                },
                {
                    name: '👤 Kunde',
                    value: name,
                    inline: true
                },
                {
                    name: '📞 Kontakt',
                    value: contact,
                    inline: true
                },
                {
                    name: '📦 Produkte',
                    value: itemLines || '—',
                    inline: false
                },
                {
                    name: '💰 Ressourcen (Gesamt)',
                    value: formatResourcesForDiscord(items),
                    inline: false
                },
                {
                    name: '📊 Status',
                    value: '🔵 **Offen**',
                    inline: true
                }
            ],
            footer: {
                text: `BulletFarm Shop • ${new Date().toLocaleDateString('de-DE')}`
            },
            timestamp: new Date().toISOString()
        }]
    };
}

/**
 * Build a Discord embed for a status update
 */
function buildStatusUpdateEmbed(order, newStatus) {
    const statusEmoji = {
        'Offen': '🔵',
        'Bearbeitet': '🟡',
        'Archiviert': '🟢',
        'Storniert': '🔴'
    };

    const statusColor = {
        'Offen': 0x60A5FA,
        'Bearbeitet': 0xFBBF24,
        'Archiviert': 0x34D399,
        'Storniert': 0xF87171
    };

    const items = order.items || [];
    const customer = order.customer || {};
    const emoji = statusEmoji[newStatus] || '⚪';

    const itemLines = items.map(i => {
        const variant = (i.variantName && i.variantName !== 'Standard') ? ` (${i.variantName})` : '';
        return `• **${i.name || 'Produkt'}**${variant} × ${i.qty}`;
    }).join('\n');

    return {
        embeds: [{
            title: `${emoji} Status: ${newStatus}`,
            color: statusColor[newStatus] || 0x94A3B8,
            fields: [
                {
                    name: '📋 Bestellung',
                    value: `\`${String(order.id || '').slice(0, 8)}\``,
                    inline: true
                },
                {
                    name: '👤 Kunde',
                    value: customer.name || 'Unbekannt',
                    inline: true
                },
                {
                    name: '📞 Kontakt',
                    value: customer.phone || customer.discord || '—',
                    inline: true
                },
                {
                    name: '📦 Produkte',
                    value: itemLines || '—',
                    inline: false
                },
                {
                    name: '💰 Ressourcen (Gesamt)',
                    value: formatResourcesForDiscord(items),
                    inline: false
                },
                {
                    name: '📊 Status',
                    value: `${emoji} **${newStatus}**`,
                    inline: true
                }
            ],
            footer: {
                text: `BulletFarm Shop • Aktualisiert ${new Date().toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
            },
            timestamp: new Date().toISOString()
        }]
    };
}

/**
 * Send a new order notification to Discord
 * Returns the message_id for future edits
 */
async function sendOrderToDiscord(order) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
        console.warn('No Discord webhook URL configured');
        return null;
    }

    try {
        const embed = buildNewOrderEmbed(order);
        const response = await fetch(webhookUrl + '?wait=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed)
        });

        if (!response.ok) {
            console.error('Discord webhook failed:', response.status, await response.text());
            return null;
        }

        const data = await response.json();
        return data.id || null; // Discord message ID
    } catch (err) {
        console.error('Discord webhook error:', err);
        return null;
    }
}

/**
 * Update an existing Discord message with new status
 * Uses PATCH to edit the original message
 */
async function updateOrderStatusInDiscord(order, newStatus, discordMessageId) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl || !discordMessageId) {
        // If no message ID, send a new message instead
        if (webhookUrl) {
            return await sendStatusUpdateAsNew(order, newStatus);
        }
        return null;
    }

    try {
        const embed = buildStatusUpdateEmbed(order, newStatus);
        const response = await fetch(`${webhookUrl}/messages/${discordMessageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed)
        });

        if (!response.ok) {
            console.warn('Discord message edit failed, sending new message:', response.status);
            return await sendStatusUpdateAsNew(order, newStatus);
        }

        return discordMessageId;
    } catch (err) {
        console.error('Discord edit error:', err);
        return await sendStatusUpdateAsNew(order, newStatus);
    }
}

/**
 * Send status update as a new message (fallback)
 */
async function sendStatusUpdateAsNew(order, newStatus) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return null;

    try {
        const embed = buildStatusUpdateEmbed(order, newStatus);
        const response = await fetch(webhookUrl + '?wait=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embed)
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.id || null;
    } catch (err) {
        console.error('Discord fallback send error:', err);
        return null;
    }
}
