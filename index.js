const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// الإعدادات
const CONFIG = {
    DISCORD_TOKEN: 'MTQyNjExMzIwNDM3OTA1ODE3Nw.GeM0kl._AO6-2e8KOlUzLmxZ7vEz093TwBl0NytbyCtcc',
    CLIENT_ID: '1426113204379058177',
    GUILD_ID: '1352960033566228510',
    TICKET_LOG_CHANNEL_ID: '1409322717865447565',
    TICKET_ADMIN_ROLE_IDS: ['1353412761308233779'],
    TICKET_CATEGORY_ID: '1426125539592110130',
    TICKET_CATEGORY_NAME: '・🎫┊𝐓𝐢𝐜𝐤𝐞𝐭𝐬',
    TICKET_PANEL_CHANNEL_ID: '1353060318376366264',
    TICKET_ADMIN_ID: '1426992092198080544'
};

const TICKETS_FILE = './tickets.json';

// أنواع التذاكر
const TICKET_TYPES = {
    spy_report: { label: 'إبلاغ عن جاسوس', emoji: '🕵️', color: 0xFF0000 },
    traitor_detection: { label: 'كشف خائن', emoji: '⚔️', color: 0xFF6B00 },
    plan_submission: { label: 'تقديم خطة', emoji: '📋', color: 0x0099FF },
    revenge_request: { label: 'طلب انتقام', emoji: '🔪', color: 0x8B0000 },
    protection_request: { label: 'طلب حماية', emoji: '🛡️', color: 0x00FF00 },
    delivery_shipment: { label: 'تسليم شحنة', emoji: '📦', color: 0xFFD700 },
    surveillance_report: { label: 'تقرير مراقبة', emoji: '📡', color: 0x800080 },
    other_reason: { label: 'سبب أخر', emoji: '❓', color: 0x808080 }
};

// أسباب الإغلاق
const CLOSE_REASONS = {
    resolved: 'تم حل المشكلة',
    duplicate: 'تذكرة مكررة',
    invalid: 'غير صالحة',
    spam: 'محتوى غير مرغوب',
    other: 'سبب آخر'
};

function loadTickets() {
    try {
        if (fs.existsSync(TICKETS_FILE)) {
            return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
        }
    } catch (error) {
        console.log('⚠️ إنشاء ملف تذاكر جديد');
    }
    return {};
}

function saveTickets(tickets) {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 4));
}

// دالة للتحقق من صلاحية الأدمن
function isAdmin(member) {
    if (!member) return false;
    return CONFIG.TICKET_ADMIN_ROLE_IDS.some(roleId => member.roles.cache.has(roleId)) || 
           member.permissions.has(PermissionsBitField.Flags.Administrator) ||
           member.id === CONFIG.TICKET_ADMIN_ID;
}

// قائمة اختيار نوع التذكرة
function createTicketTypeMenu() {
    const options = Object.entries(TICKET_TYPES).map(([value, config]) => 
        new StringSelectMenuOptionBuilder()
            .setLabel(config.label)
            .setEmoji(config.emoji)
            .setValue(value)
    );

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_ticket_type')
            .setPlaceholder('🚨 اختر نوع التذكرة')
            .addOptions(options)
    );
}

// أزرار التحكم في التذكرة (بعد الاستلام)
function createTicketControls() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('إلغاء الاستلام').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('add_member').setLabel('إضافة مستخدم').setEmoji('👥').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rename_ticket').setLabel('إعادة تسمية').setEmoji('📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('remind_member').setLabel('تذكير العضو').setEmoji('⏰').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );
}

// زر الاستلام فقط (يظهر قبل الاستلام)
function createClaimButton() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setEmoji('✅').setStyle(ButtonStyle.Success)
    );
}

// قائمة أسباب الإغلاق
function createCloseReasonMenu() {
    const options = Object.entries(CLOSE_REASONS).map(([value, label]) => 
        new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)
    );

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_close_reason')
            .setPlaceholder('📝 اختر سبب الإغلاق')
            .addOptions(options)
    );
}

// نموذج كتابة السبب يدوياً
function createCustomReasonModal() {
    return new ModalBuilder()
        .setCustomId('custom_reason_modal')
        .setTitle('كتابة سبب الإغلاق')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('custom_reason')
                    .setLabel('سبب الإغلاق')
                    .setPlaceholder('اكتب سبب إغلاق التذكرة هنا...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(500)
            )
        );
}

// نموذج إضافة عضو
function createAddMemberModal() {
    return new ModalBuilder()
        .setCustomId('add_member_modal')
        .setTitle('إضافة عضو للتذكرة')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('member_id')
                    .setLabel('ID العضو')
                    .setPlaceholder('123456789012345678')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
}

// نموذج إعادة تسمية التذكرة
function createRenameTicketModal() {
    return new ModalBuilder()
        .setCustomId('rename_ticket_modal')
        .setTitle('إعادة تسمية التذكرة')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('new_name')
                    .setLabel('الاسم الجديد')
                    .setPlaceholder('اسم التذكرة الجديد')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100)
            )
        );
}

// ========== واجهة فتح التذكرة العصرية ==========
async function sendTicketCreatedDM(ticket, user) {
    try {
        const config = TICKET_TYPES[ticket.type];
        const createdTime = new Date(ticket.created_at).getTime();
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎫 تم إنشاء تذكرتك بنجاح!')
            .setDescription(`**مرحباً ${user.username}! تم إنشاء تذكرتك بنجاح**\n${'═'.repeat(45)}`)
            .setColor(config.color)
            .setThumbnail('https://i.ibb.co/4nm5wHc6/Chat-GPT-Image-Oct-11-2025-01-59-28-PM.png')
            .addFields(
                { 
                    name: '📋 **معلومات التذكرة**',
                    value: `**النوع:** ${config.label}\n**الرقم:** ${ticket.id}\n**الحالة:** 🟢 مفتوحة`,
                    inline: false 
                },
                { 
                    name: '⏰ **التوقيت**',
                    value: `**وقت الإنشاء:** <t:${Math.floor(createdTime/1000)}:F>\n**الوقت المنقضي:** <t:${Math.floor(createdTime/1000)}:R>`,
                    inline: false 
                },
                { 
                    name: '👤 **معلوماتك**',
                    value: `**الاسم:** ${user.tag}\n**الأيدي:** ${user.id}`,
                    inline: false 
                },
                { 
                    name: '💡 **ماذا بعد؟**',
                    value: 'فريق الدعم سيتواصل معك قريباً. الرجاء الانتظار وسيتم الرد على تذكرتك في أقرب وقت ممكن.',
                    inline: false 
                }
            )
            .setFooter({ 
                text: 'فريق الدعم سيتواصل معك قريباً | شكراً لثقتك بنا', 
                iconURL: user.displayAvatarURL() 
            })
            .setTimestamp();

        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🚀 الذهاب إلى التذكرة')
                .setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channel_id}`)
                .setStyle(ButtonStyle.Link)
        );

        await user.send({ 
            embeds: [welcomeEmbed],
            components: [actionButtons]
        });

    } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة الترحيب:', error);
    }
}

// ========== واجهة إغلاق التذكرة العصرية ==========
async function sendTicketClosedDM(ticket, closedBy, reason) {
    try {
        const user = await client.users.fetch(ticket.user_id);
        const config = TICKET_TYPES[ticket.type];
        
        // حساب مدة التذكرة بدقة
        const createdTime = new Date(ticket.created_at).getTime();
        const closedTime = new Date().getTime();
        const durationMs = closedTime - createdTime;
        
        const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let durationText = '';
        if (days > 0) durationText += `${days} يوم `;
        if (hours > 0) durationText += `${hours} ساعة `;
        if (minutes > 0) durationText += `${minutes} دقيقة`;
        if (durationText === '') durationText = 'أقل من دقيقة';

        // جلب بيانات المستلم إذا موجود
        let claimedByInfo = 'لم يتم الاستلام';
        if (ticket.claimed_by) {
            const claimedByUser = await client.users.fetch(ticket.claimed_by).catch(() => null);
            claimedByInfo = claimedByUser ? `${claimedByUser.tag}` : 'غير معروف';
        }

        // إنشاء واجهة عصرية وشاملة
        const closeEmbed = new EmbedBuilder()
            .setTitle('🎫 تقرير إغلاق التذكرة')
            .setDescription(`**تم إغلاق تذكرتك بنجاح**\n${'═'.repeat(45)}`)
            .setColor(0x2F3136)
            .setThumbnail('https://i.ibb.co/4nm5wHc6/Chat-GPT-Image-Oct-11-2025-01-59-28-PM.png')
            .addFields(
                { 
                    name: '📊 **معلومات التذكرة**',
                    value: `**النوع:** ${config.label}\n**الرقم:** ${ticket.id}\n**الحالة:** 🔴 مغلقة\n**المدة الكلية:** ${durationText}`,
                    inline: false 
                },
                { 
                    name: '⏰ **التوقيتات**',
                    value: `**وقت الإنشاء:** <t:${Math.floor(createdTime/1000)}:F>\n**وقت الإغلاق:** <t:${Math.floor(closedTime/1000)}:F>`,
                    inline: false 
                },
                { 
                    name: '👥 **فريق الدعم**',
                    value: `**المستلم:** ${claimedByInfo}\n**المغلق:** ${closedBy.tag}\n**سبب الإغلاق:** ${reason}`,
                    inline: false 
                },
                { 
                    name: '📈 **إحصائيات**',
                    value: `**عدد الأعضاء:** ${ticket.members.length}\n**النوع:** ${ticket.type_label}`,
                    inline: false 
                },
                { 
                    name: '💡 **ملاحظة**',
                    value: 'شكراً لاستخدامك نظام التذاكر. نأمل أن نكون عند حسن ظنك!',
                    inline: false 
                }
            )
            .setFooter({ 
                text: 'شكراً لاستخدامك نظام التذاكر | نأمل أن نكون عند حسن ظنك', 
                iconURL: user.displayAvatarURL() 
            })
            .setTimestamp();

        await user.send({ 
            embeds: [closeEmbed]
        });

    } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة الإغلاق:', error);
        
        // في حالة فشل إرسال الرسالة، نرسلها في قناة اللوج
        try {
            const logChannel = await client.channels.fetch(CONFIG.TICKET_LOG_CHANNEL_ID);
            const user = await client.users.fetch(ticket.user_id);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('⚠️ تعذر إرسال تقرير الإغلاق')
                .setDescription(`**لم نتمكن من إرسال تقرير الإغلاق إلى ${user.tag}**\n\nيرجى إعلامهم يدوياً.`)
                .setColor(0xFFA500)
                .addFields(
                    { name: 'التذكرة', value: ticket.id, inline: true },
                    { name: 'المستخدم', value: user.tag, inline: true },
                    { name: 'السبب', value: 'إعدادات الخصوصية', inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [errorEmbed] });
        } catch (logError) {
            console.error('❌ خطأ في تسجيل الخطأ:', logError);
        }
    }
}

// ========== واجهة تذكير العضو العصرية ==========
async function sendReminderDM(ticket, remindedBy, reminderReason = null) {
    try {
        const user = await client.users.fetch(ticket.user_id);
        const config = TICKET_TYPES[ticket.type];
        
        // حساب مدة التذكرة بدقة
        const createdTime = new Date(ticket.created_at).getTime();
        const currentTime = new Date().getTime();
        const durationMs = currentTime - createdTime;
        
        const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let durationText = '';
        if (days > 0) durationText += `${days} يوم `;
        if (hours > 0) durationText += `${hours} ساعة `;
        if (minutes > 0) durationText += `${minutes} دقيقة`;
        if (durationText === '') durationText = 'أقل من دقيقة';

        // جلب بيانات المستلم إذا موجود
        let claimedByInfo = 'لم يتم الاستلام';
        if (ticket.claimed_by) {
            const claimedByUser = await client.users.fetch(ticket.claimed_by).catch(() => null);
            claimedByInfo = claimedByUser ? `${claimedByUser.tag}` : 'غير معروف';
        }

        // إنشاء واجهة عصرية وشاملة للتذكير
        const reminderEmbed = new EmbedBuilder()
            .setTitle('⏰ تذكير من فريق الدعم')
            .setDescription(`**تم إرسال تذكير لك بخصوص تذكرتك**\n${'═'.repeat(45)}`)
            .setColor(0xFFA500) // لون برتقالي مناسب للتذكير
            .setThumbnail('https://i.ibb.co/4nm5wHc6/Chat-GPT-Image-Oct-11-2025-01-59-28-PM.png')
            .addFields(
                { 
                    name: '📋 **معلومات التذكرة**',
                    value: `**النوع:** ${config.label}\n**الرقم:** ${ticket.id}\n**الحالة:** 🟡 بانتظار ردك\n**المدة المنقضية:** ${durationText}`,
                    inline: false 
                },
                { 
                    name: '👤 **المذكر**',
                    value: `**الاسم:** ${remindedBy.tag}\n**الدور:** مسؤول التذاكر\n**الأيدي:** ${remindedBy.id}`,
                    inline: false 
                },
                { 
                    name: '⏰ **التوقيتات**',
                    value: `**وقت الإنشاء:** <t:${Math.floor(createdTime/1000)}:F>\n**وقت التذكير:** <t:${Math.floor(currentTime/1000)}:F>\n**المنقضي:** <t:${Math.floor(createdTime/1000)}:R>`,
                    inline: false 
                },
                { 
                    name: '💬 **رسالة التذكير**',
                    value: reminderReason && reminderReason.trim() !== '' 
                        ? `**${reminderReason}**` 
                        : '**نحن بانتظار ردك على تذكرتك المفتوحة. الرجاء الرد في أقرب وقت ممكن.**',
                    inline: false 
                },
                { 
                    name: '👥 **فريق الدعم**',
                    value: `**المستلم الحالي:** ${claimedByInfo}`,
                    inline: false 
                },
                { 
                    name: '💡 **ماذا يجب أن تفعل؟**',
                    value: 'يرجى الرد على تذكرتك في أقرب وقت ممكن حتى نتمكن من مساعدتك.',
                    inline: false 
                }
            )
            .setFooter({ 
                text: 'شكراً لتعاونك | فريق دعم البراتفا', 
                iconURL: user.displayAvatarURL() 
            })
            .setTimestamp();

        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🚀 الذهاب إلى التذكرة')
                .setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channel_id}`)
                .setStyle(ButtonStyle.Link)
        );

        await user.send({ 
            embeds: [reminderEmbed],
            components: [actionButtons]
        });

        console.log(`✅ تم إرسال تذكير إلى ${user.tag} مع الرسالة: ${reminderReason || 'تذكير عام'}`);
        return true;

    } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة التذكير:', error);
        return false;
    }
}

// إرسال رسالة استلام التذكرة للعضو
async function sendTicketClaimedDM(ticket, claimedBy) {
    try {
        const user = await client.users.fetch(ticket.user_id);
        const config = TICKET_TYPES[ticket.type];
        const createdTime = new Date(ticket.created_at).getTime();
        const currentTime = new Date().getTime();
        const durationMs = currentTime - createdTime;
        
        const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let durationText = '';
        if (days > 0) durationText += `${days} يوم `;
        if (hours > 0) durationText += `${hours} ساعة `;
        if (minutes > 0) durationText += `${minutes} دقيقة`;
        if (durationText === '') durationText = 'أقل من دقيقة';
        
        const claimEmbed = new EmbedBuilder()
            .setTitle('✅ تم استلام تذكرتك')
            .setDescription(`**تم استلام تذكرتك من قبل فريق الدعم**\n${'═'.repeat(45)}`)
            .setColor(0x00FF00)
            .setThumbnail('https://i.ibb.co/4nm5wHc6/Chat-GPT-Image-Oct-11-2025-01-59-28-PM.png')
            .addFields(
                { 
                    name: '📋 **معلومات التذكرة**',
                    value: `**النوع:** ${config.label}\n**الرقم:** ${ticket.id}\n**الحالة:** 🟢 تحت المتابعة\n**مدة الانتظار:** ${durationText}`,
                    inline: false 
                },
                { 
                    name: '👤 **المسؤول**',
                    value: `**الاسم:** ${claimedBy.tag}\n**الدور:** مسؤول التذاكر\n**الأيدي:** ${claimedBy.id}`,
                    inline: false 
                },
                { 
                    name: '⏰ **التوقيت**',
                    value: `**وقت الإنشاء:** <t:${Math.floor(createdTime/1000)}:F>\n**وقت الاستلام:** <t:${Math.floor(currentTime/1000)}:F>`,
                    inline: false 
                },
                { 
                    name: '💡 **ماذا بعد؟**',
                    value: 'سيتم الرد على استفسارك قريباً. يمكنك متابعة المحادثة في قناة التذكرة.',
                    inline: false 
                }
            )
            .setFooter({ 
                text: 'سيتم الرد على استفسارك قريباً | شكراً لصبرك', 
                iconURL: user.displayAvatarURL() 
            })
            .setTimestamp();

        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🚀 الذهاب إلى التذكرة')
                .setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channel_id}`)
                .setStyle(ButtonStyle.Link)
        );

        await user.send({ 
            embeds: [claimEmbed],
            components: [actionButtons]
        });

    } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة الاستلام:', error);
    }
}

// إرسال رسالة إلغاء استلام التذكرة للعضو
async function sendTicketUnclaimedDM(ticket, unclaimedBy) {
    try {
        const user = await client.users.fetch(ticket.user_id);
        const config = TICKET_TYPES[ticket.type];
        const createdTime = new Date(ticket.created_at).getTime();
        const currentTime = new Date().getTime();
        const durationMs = currentTime - createdTime;
        
        const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let durationText = '';
        if (days > 0) durationText += `${days} يوم `;
        if (hours > 0) durationText += `${hours} ساعة `;
        if (minutes > 0) durationText += `${minutes} دقيقة`;
        if (durationText === '') durationText = 'أقل من دقيقة';

        const unclaimEmbed = new EmbedBuilder()
            .setTitle('↩️ تم إلغاء استلام تذكرتك')
            .setDescription(`**تم إلغاء استلام تذكرتك وسيتم تعيين مسؤول آخر لها**\n${'═'.repeat(45)}`)
            .setColor(0xFFFF00)
            .setThumbnail('https://i.ibb.co/4nm5wHc6/Chat-GPT-Image-Oct-11-2025-01-59-28-PM.png')
            .addFields(
                { 
                    name: '📋 **معلومات التذكرة**',
                    value: `**النوع:** ${config.label}\n**الرقم:** ${ticket.id}\n**الحالة:** 🟡 بانتظار استلام جديد\n**المدة المنقضية:** ${durationText}`,
                    inline: false 
                },
                { 
                    name: '👤 **ملغي الاستلام**',
                    value: `**الاسم:** ${unclaimedBy.tag}\n**الدور:** مسؤول التذاكر\n**الأيدي:** ${unclaimedBy.id}`,
                    inline: false 
                },
                { 
                    name: '⏰ **التوقيت**',
                    value: `**وقت الإنشاء:** <t:${Math.floor(createdTime/1000)}:F>\n**وقت إلغاء الاستلام:** <t:${Math.floor(currentTime/1000)}:F>`,
                    inline: false 
                },
                { 
                    name: '💡 **ماذا يعني هذا؟**',
                    value: 'سيقوم مسؤول آخر باستلام تذكرتك قريباً. نعتذر لأي إزعاج قد سببته هذه العملية.',
                    inline: false 
                }
            )
            .setFooter({ 
                text: 'سيقوم مسؤول آخر باستلام تذكرتك قريباً | نعتذر لأي إزعاج', 
                iconURL: user.displayAvatarURL() 
            })
            .setTimestamp();

        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🚀 الذهاب إلى التذكرة')
                .setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channel_id}`)
                .setStyle(ButtonStyle.Link)
        );

        await user.send({ 
            embeds: [unclaimEmbed],
            components: [actionButtons]
        });

    } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة إلغاء الاستلام:', error);
    }
}

// تسجيل التذكرة في قناة اللوج
async function logTicketAction(action, ticket, user, reason = null, claimedBy = null) {
    try {
        const logChannel = await client.channels.fetch(CONFIG.TICKET_LOG_CHANNEL_ID);
        const config = TICKET_TYPES[ticket.type];
        
        const logEmbed = new EmbedBuilder()
            .setColor(config?.color || 0x0099FF)
            .setTimestamp();

        if (action === 'created') {
            logEmbed
                .setTitle('🎫 تذكرة جديدة')
                .setDescription(`**تم إنشاء تذكرة جديدة**`)
                .addFields(
                    { name: 'النوع', value: config.label, inline: true },
                    { name: 'المنشئ', value: `<@${ticket.user_id}>`, inline: true },
                    { name: 'القناة', value: `<#${ticket.channel_id}>`, inline: true },
                    { name: 'الوقت', value: `<t:${Math.floor(new Date(ticket.created_at).getTime()/1000)}:R>`, inline: false }
                );
        } else if (action === 'claimed') {
            logEmbed
                .setTitle('👤 تم استلام التذكرة')
                .setDescription(`**تم استلام التذكرة**`)
                .addFields(
                    { name: 'النوع', value: config.label, inline: true },
                    { name: 'المنشئ', value: `<@${ticket.user_id}>`, inline: true },
                    { name: 'المستلم', value: `<@${claimedBy.id}>`, inline: true },
                    { name: 'القناة', value: `<#${ticket.channel_id}>`, inline: true }
                );
        } else if (action === 'unclaimed') {
            logEmbed
                .setTitle('↩️ تم إلغاء استلام التذكرة')
                .setDescription(`**تم إلغاء استلام التذكرة**`)
                .addFields(
                    { name: 'النوع', value: config.label, inline: true },
                    { name: 'المنشئ', value: `<@${ticket.user_id}>`, inline: true },
                    { name: 'ملغي الاستلام', value: `<@${user.id}>`, inline: true },
                    { name: 'القناة', value: `<#${ticket.channel_id}>`, inline: true }
                );
        } else if (action === 'closed') {
            logEmbed
                .setTitle('🔒 تذكرة مغلقة')
                .setDescription(`**تم إغلاق تذكرة**`)
                .addFields(
                    { name: 'النوع', value: config.label, inline: true },
                    { name: 'المنشئ', value: `<@${ticket.user_id}>`, inline: true },
                    { name: 'المغلق', value: `<@${user.id}>`, inline: true },
                    { name: 'سبب الإغلاق', value: reason || 'غير محدد', inline: true },
                    { name: 'مدة التذكرة', value: `<t:${Math.floor(new Date(ticket.created_at).getTime()/1000)}:R>`, inline: true }
                );
        } else if (action === 'reminded') {
            logEmbed
                .setTitle('⏰ تذكير مرسل')
                .setDescription(`**تم إرسال تذكير للعضو**`)
                .addFields(
                    { name: 'النوع', value: config.label, inline: true },
                    { name: 'المنشئ', value: `<@${ticket.user_id}>`, inline: true },
                    { name: 'المذكر', value: `<@${user.id}>`, inline: true },
                    { name: 'القناة', value: `<#${ticket.channel_id}>`, inline: true },
                    { name: 'سبب التذكير', value: reason || 'تذكير عام', inline: true }
                );
        }

        await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
        console.error('❌ خطأ في تسجيل التذكرة:', error);
    }
}

// ========== أمر حذف كل التذاكر ==========
async function deleteAllTickets(message) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ لا تملك صلاحية استخدام هذا الأمر!');
    }

    try {
        const tickets = loadTickets();
        const guild = message.guild;
        let deletedCount = 0;
        let errorCount = 0;

        // حذف جميع قنوات التذاكر
        for (const ticketId in tickets) {
            try {
                const channel = await guild.channels.fetch(ticketId).catch(() => null);
                if (channel) {
                    await channel.delete();
                    deletedCount++;
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ خطأ في حذف القناة ${ticketId}:`, error);
            }
        }

        // حذف ملف التذاكر
        if (fs.existsSync(TICKETS_FILE)) {
            fs.unlinkSync(TICKETS_FILE);
        }

        const resultEmbed = new EmbedBuilder()
            .setTitle('🧹 تنظيف شامل للنظام')
            .setColor(0x00FF00)
            .setDescription('**تم مسح جميع التذاكر والبيانات بنجاح!**')
            .addFields(
                { name: '✅ القنوات المحذوفة', value: `${deletedCount}`, inline: true },
                { name: '❌ الأخطاء', value: `${errorCount}`, inline: true },
                { name: '🗑️ ملف البيانات', value: 'تم حذفه', inline: true }
            )
            .setFooter({ text: 'تم التنظيف بنجاح' })
            .setTimestamp();

        await message.reply({ embeds: [resultEmbed] });

    } catch (error) {
        console.error('❌ خطأ في حذف التذاكر:', error);
        await message.reply('❌ حدث خطأ أثناء حذف التذاكر!');
    }
}

// ========== زر استلام التذكرة ==========
async function claimTicket(interaction) {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
            content: '❌ لا تملك صلاحية استلام التذاكر! هذه الميزة للمسؤولين فقط.',
            flags: 64
        });
        return;
    }

    const channel = interaction.channel;
    const tickets = loadTickets();
    const ticket = tickets[channel.id];

    if (!ticket) {
        await interaction.reply({ content: '❌ هذه القناة ليست تذكرة صالحة.', flags: 64 });
        return;
    }

    if (ticket.claimed_by) {
        await interaction.reply({ content: '❌ هذه التذكرة مستلمة بالفعل!', flags: 64 });
        return;
    }

    try {
        ticket.claimed_by = interaction.user.id;
        ticket.claimed_at = new Date().toISOString();
        saveTickets(tickets);

        await sendTicketClaimedDM(ticket, interaction.user);
        await logTicketAction('claimed', ticket, interaction.user, null, interaction.user);

        const claimedEmbed = new EmbedBuilder()
            .setTitle('✅ تم استلام التذكرة')
            .setDescription(`**تم استلام التذكرة بواسطة ${interaction.user}**\n\nيمكنك إلغاء الاستلام إذا أردت.`)
            .setColor(0x00FF00)
            .setThumbnail('https://i.ibb.co/4nm5wHc6/Chat-GPT-Image-Oct-11-2025-01-59-28-PM.png')
            .setFooter({ text: 'شكراً لتفهمك' })
            .setTimestamp();

        await interaction.reply({ 
            embeds: [claimedEmbed],
            components: [createTicketControls()]
        });

    } catch (error) {
        console.error('❌ خطأ في استلام التذكرة:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء استلام التذكرة!',
            flags: 64
        });
    }
}

// ========== زر إلغاء الاستلام ==========
async function unclaimTicket(interaction) {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
            content: '❌ لا تملك صلاحية إلغاء استلام التذاكر! هذه الميزة للمسؤولين فقط.',
            flags: 64
        });
        return;
    }

    const channel = interaction.channel;
    const tickets = loadTickets();
    const ticket = tickets[channel.id];

    if (!ticket) {
        await interaction.reply({ content: '❌ هذه القناة ليست تذكرة صالحة.', flags: 64 });
        return;
    }

    if (!ticket.claimed_by) {
        await interaction.reply({ content: '❌ هذه التذكرة غير مستلمة!', flags: 64 });
        return;
    }

    if (ticket.claimed_by !== interaction.user.id) {
        await interaction.reply({ content: '❌ يمكنك فقط إلغاء استلام التذاكر التي استلمتها!', flags: 64 });
        return;
    }

    try {
        const previousClaimer = ticket.claimed_by;
        ticket.claimed_by = null;
        ticket.claimed_at = null;
        saveTickets(tickets);

        await sendTicketUnclaimedDM(ticket, interaction.user);
        await logTicketAction('unclaimed', ticket, interaction.user);

        const unclaimEmbed = new EmbedBuilder()
            .setTitle('↩️ تم إلغاء استلام التذكرة')
            .setDescription(`**تم إلغاء استلام التذكرة بواسطة ${interaction.user}**\n\nيمكن لأي مسؤول آخر استلام التذكرة الآن.`)
            .setColor(0xFFFF00)
            .setThumbnail('https://i.ibb.co/4nm5wHc6/Chat-GPT-Image-Oct-11-2025-01-59-28-PM.png')
            .setFooter({ text: 'في انتظار استلام جديد' })
            .setTimestamp();

        // منشن لرول مسؤول التذاكر باستخدام الأيدي
        const adminRoleMention = `<@&1426992092198080544>`;

        await interaction.reply({ 
            content: `${adminRoleMention}\n⚠️ تذكرة تحتاج استلام!`,
            embeds: [unclaimEmbed],
            components: [createClaimButton()]
        });

    } catch (error) {
        console.error('❌ خطأ في إلغاء استلام التذكرة:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء إلغاء استلام التذكرة!',
            flags: 64
        });
    }
}

// ========== وظيفة التذكير المحسنة ==========
async function remindMember(interaction) {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
            content: '❌ لا تملك صلاحية للتذكير! هذه الميزة للمسؤولين فقط.',
            flags: 64
        });
        return;
    }

    const channel = interaction.channel;
    const tickets = loadTickets();
    const ticket = tickets[channel.id];

    if (!ticket) {
        await interaction.reply({ content: '❌ هذه القناة ليست تذكرة صالحة.', flags: 64 });
        return;
    }

    try {
        const reminderModal = new ModalBuilder()
            .setCustomId('reminder_modal')
            .setTitle('إرسال تذكير للعضو')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reminder_reason')
                        .setLabel('رسالة التذكير (اختياري)')
                        .setPlaceholder('اكتب رسالة تذكير مخصصة...')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                        .setMaxLength(1000)
                )
            );

        await interaction.showModal(reminderModal);

    } catch (error) {
        console.error('❌ خطأ في إظهار نموذج التذكير:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء إعداد التذكير!',
            flags: 64
        });
    }
}

// معالجة نموذج التذكير
async function handleReminderModal(interaction) {
    const reminderReason = interaction.fields.getTextInputValue('reminder_reason');
    const channel = interaction.channel;
    const tickets = loadTickets();
    const ticket = tickets[channel.id];

    if (!ticket) {
        await interaction.reply({ content: '❌ هذه القناة ليست تذكرة صالحة.', flags: 64 });
        return;
    }

    try {
        const user = await client.users.fetch(ticket.user_id);
        const sent = await sendReminderDM(ticket, interaction.user, reminderReason);
        
        if (sent) {
            await logTicketAction('reminded', ticket, interaction.user, reminderReason);

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ تم إرسال التذكير')
                .setDescription(`**تم إرسال تذكير بنجاح إلى ${user.tag}**`)
                .setColor(0x00FF00)
                .addFields(
                    { name: 'المذكر', value: interaction.user.tag, inline: true },
                    { name: 'الوقت', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
                    { name: 'الرسالة', value: reminderReason || 'تذكير عام', inline: false }
                )
                .setFooter({ text: 'سيتم متابعة التذكرة' })
                .setTimestamp();

            await interaction.reply({ 
                embeds: [successEmbed],
                flags: 64
            });

            const channelEmbed = new EmbedBuilder()
                .setDescription(`⏰ تم إرسال تذكير إلى ${user} بواسطة ${interaction.user}`)
                .setColor(0xFFA500)
                .setTimestamp();

            await channel.send({ embeds: [channelEmbed] });

        } else {
            await interaction.reply({
                content: '❌ لا يمكن إرسال رسالة خاصة لهذا العضو',
                flags: 64
            });
        }
    } catch (error) {
        console.error('❌ خطأ في إرسال التذكير:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء إرسال التذكير!',
            flags: 64
        });
    }
}

async function createTicketChannel(interaction, ticketType) {
    try {
        const guild = interaction.guild;
        const user = interaction.user;
        const config = TICKET_TYPES[ticketType];
        
        const tickets = loadTickets();
        
        const activeTickets = Object.values(tickets).filter(t => 
            t.user_id === user.id && t.status === 'open'
        );
        
        if (activeTickets.length >= 1) {
            await interaction.reply({
                content: '❌ لديك تذكرة مفتوحة بالفعل! الرجاء إغلاقها أولاً قبل إنشاء تذكرة جديدة.',
                flags: 64
            });
            return;
        }

        const overwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
            { id: CONFIG.TICKET_ADMIN_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages] }
        ];

        for (const roleId of CONFIG.TICKET_ADMIN_ROLE_IDS) {
            try {
                const role = await guild.roles.fetch(roleId);
                if (role) {
                    overwrites.push({
                        id: roleId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages]
                    });
                }
            } catch (error) {
                console.log(`⚠️ الرول ${roleId} غير موجود، سيتم تخطيه`);
            }
        }

        let category;
        try {
            category = await guild.channels.fetch(CONFIG.TICKET_CATEGORY_ID);
        } catch (error) {
            category = guild.channels.cache.find(ch => 
                ch.type === ChannelType.GuildCategory && ch.name === CONFIG.TICKET_CATEGORY_NAME
            ) || await guild.channels.create({
                name: CONFIG.TICKET_CATEGORY_NAME,
                type: ChannelType.GuildCategory
            });
        }

        const ticketChannel = await guild.channels.create({
            name: `${config.emoji}-${user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites,
            topic: `تذكرة ${config.label} - ${user.tag}`
        });

        const ticketId = ticketChannel.id;
        tickets[ticketId] = {
            id: ticketId,
            user_id: user.id,
            user_name: user.username,
            user_tag: user.tag,
            channel_id: ticketChannel.id,
            type: ticketType,
            type_label: config.label,
            status: 'open',
            created_at: new Date().toISOString(),
            members: [user.id],
            claimed_by: null,
            claimed_at: null,
            messages: []
        };
        saveTickets(tickets);

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${config.emoji} تذكرة ${config.label}`)
            .setDescription(`**مرحباً ${user}!**\n\nتم إنشاء تذكرتك بنجاح!\n\n**معلومات التذكرة:**\n• النوع: ${config.label}\n• المنشئ: ${user.tag}\n• الوقت: <t:${Math.floor(Date.now()/1000)}:R>`)
            .setColor(config.color)
            .addFields(
                { name: '🛠️ أدوات التذكرة', value: 'سيقوم أحد المسؤولين باستلام تذكرتك قريباً', inline: false }
            )
            .setFooter({ text: `ID: ${ticketId}` })
            .setTimestamp();

        // منشن لرول مسؤول التذاكر باستخدام الأيدي
        const adminRoleMention = `<@&1426992092198080544>`;

        await ticketChannel.send({
            content: `${user} ${adminRoleMention}`, // المستخدم + رول الأدمن بالأيدي
            embeds: [welcomeEmbed],
            components: [createClaimButton()]
        });

        await interaction.reply({
            content: `✅ تم إنشاء تذكرتك: ${ticketChannel}`,
            flags: 64
        });

        await sendTicketCreatedDM(tickets[ticketId], user);
        await logTicketAction('created', tickets[ticketId], user);
    } catch (error) {
        console.error('❌ خطأ في إنشاء التذكرة:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء إنشاء التذكرة!',
            flags: 64
        });
    }
}

async function addMemberToTicket(interaction, memberId) {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
            content: '❌ لا تملك صلاحية لإضافة أعضاء! هذه الميزة للمسؤولين فقط.',
            flags: 64
        });
        return;
    }

    const channel = interaction.channel;
    const tickets = loadTickets();
    const ticket = tickets[channel.id];

    if (!ticket) {
        await interaction.reply({ content: '❌ هذه القناة ليست تذكرة صالحة.', flags: 64 });
        return;
    }

    try {
        const member = await interaction.guild.members.fetch(memberId);
        await channel.permissionOverwrites.create(member, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        if (!ticket.members.includes(memberId)) {
            ticket.members.push(memberId);
            saveTickets(tickets);
        }

        await interaction.reply({
            content: `✅ تم إضافة ${member} إلى التذكرة`,
            flags: 64
        });

        const embed = new EmbedBuilder()
            .setDescription(`👥 تم إضافة ${member} إلى التذكرة بواسطة ${interaction.user}`)
            .setColor(0x00FF00)
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({
            content: '❌ لم أتمكن من العثور على هذا العضو!',
            flags: 64
        });
    }
}

async function renameTicket(interaction, newName) {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
            content: '❌ لا تملك صلاحية لإعادة تسمية التذاكر! هذه الميزة للمسؤولين فقط.',
            flags: 64
        });
        return;
    }

    const channel = interaction.channel;
    const tickets = loadTickets();
    const ticket = tickets[channel.id];

    if (!ticket) {
        await interaction.reply({ content: '❌ هذه القناة ليست تذكرة صالحة.', flags: 64 });
        return;
    }

    try {
        await channel.setName(newName);
        
        await interaction.reply({
            content: `✅ تم تغيير اسم التذكرة إلى: ${newName}`,
            flags: 64
        });

        const embed = new EmbedBuilder()
            .setDescription(`📝 تم إعادة تسمية التذكرة إلى "${newName}" بواسطة ${interaction.user}`)
            .setColor(0x0099FF)
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        await interaction.reply({
            content: '❌ حدث خطأ أثناء إعادة تسمية التذكرة!',
            flags: 64
        });
    }
}

async function closeTicket(interaction, reason = 'غير محدد') {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
            content: '❌ لا تملك صلاحية لإغلاق التذاكر! هذه الميزة للمسؤولين فقط.',
            flags: 64
        });
        return;
    }

    const channel = interaction.channel;
    const tickets = loadTickets();
    const ticket = tickets[channel.id];

    if (!ticket) {
        await interaction.reply({ content: '❌ هذه القناة ليست تذكرة صالحة.', flags: 64 });
        return;
    }

    try {
        ticket.status = 'closed';
        ticket.closed_at = new Date().toISOString();
        ticket.closed_by = interaction.user.id;
        ticket.close_reason = reason;
        saveTickets(tickets);

        const config = TICKET_TYPES[ticket.type];
        
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 تم إغلاق التذكرة')
            .setColor(0xFF0000)
            .setDescription(`**تم إغلاق التذكرة بواسطة ${interaction.user}**\n\nسيتم إرسال تقرير مفصل إلى صاحب التذكرة.`)
            .addFields(
                { name: 'سبب الإغلاق', value: reason, inline: true },
                { name: 'مدة التذكرة', value: `<t:${Math.floor(new Date(ticket.created_at).getTime()/1000)}:R>`, inline: true },
                { name: 'رقم التذكرة', value: ticket.id, inline: true }
            )
            .setFooter({ text: 'سيتم حذف القناة تلقائياً خلال 5 ثوان' })
            .setTimestamp();

        await channel.send({ embeds: [closeEmbed] });
        await interaction.reply({ content: '✅ جاري إغلاق التذكرة وإرسال التقرير...', flags: 64 });

        await sendTicketClosedDM(ticket, interaction.user, reason);
        await logTicketAction('closed', ticket, interaction.user, reason);

        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (error) {
                console.error('Error deleting channel:', error);
            }
        }, 8000);

    } catch (error) {
        console.error('❌ خطأ في إغلاق التذكرة:', error);
        await interaction.reply({
            content: '❌ حدث خطأ أثناء إغلاق التذكرة!',
            flags: 64
        });
    }
}

// حدث عندما يرسل أحد المسؤولين رسالة في التذكرة (يعني استلمها)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const tickets = loadTickets();
    const ticket = tickets[message.channel.id];
    
    if (ticket && ticket.status === 'open' && isAdmin(message.member)) {
        if (!ticket.claimed_by) {
            ticket.claimed_by = message.author.id;
            ticket.claimed_at = new Date().toISOString();
            saveTickets(tickets);
            
            await sendTicketClaimedDM(ticket, message.author);
            await logTicketAction('claimed', ticket, message.author, null, message.author);
            
            const claimedEmbed = new EmbedBuilder()
                .setDescription(`✅ تم استلام التذكرة بواسطة ${message.author}`)
                .setColor(0x00FF00)
                .setTimestamp();
                
            await message.channel.send({ embeds: [claimedEmbed] });
            
            const messageWithButtons = await message.channel.messages.fetch({ limit: 10 })
                .then(messages => messages.find(m => m.components.length > 0));
            
            if (messageWithButtons) {
                await messageWithButtons.edit({ components: [createTicketControls()] });
            }
        }
    }
});

// إنشاء البانل في القناة المحددة
async function createTicketPanel() {
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const panelChannel = await client.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID);
        
        const panelEmbed = new EmbedBuilder()
            .setTitle('🎫 نظام التذاكر')
            .setDescription('**لإنشاء تذكرة، اضغط على الزر أدناه**')
            .setColor(0x0099FF)
            .setImage('https://i.ibb.co/bgHjT6qF/44.png')
            .setFooter({ text: 'نظام التذاكر المتقدم' })
            .setTimestamp();

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('إنشاء تذكرة')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary)
        );

        try {
            const messages = await panelChannel.messages.fetch({ limit: 10 });
            await panelChannel.bulkDelete(messages);
        } catch (error) {
            console.log('⚠️ لا توجد رسائل قديمة للمسح');
        }
        
        await panelChannel.send({ embeds: [panelEmbed], components: [button] });
        console.log('✅ تم إنشاء بانل التذاكر في القناة المحددة');
    } catch (error) {
        console.error('❌ خطأ في إنشاء البانل:', error.message);
    }
}

// الأحداث
client.once('ready', async () => {
    console.log(`✅ البوت شغال: ${client.user.tag}`);
    client.user.setActivity('التذاكر | اضغط زر التذكرة', { type: 'WATCHING' });
    
    await createTicketPanel();
});

client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_ticket_type') {
            await createTicketChannel(interaction, interaction.values[0]);
        }
        
        if (interaction.customId === 'select_close_reason') {
            const reason = interaction.values[0];
            
            if (reason === 'other') {
                await interaction.showModal(createCustomReasonModal());
            } else {
                await closeTicket(interaction, CLOSE_REASONS[reason]);
            }
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            await interaction.reply({
                content: '🚨 اختر نوع التذكرة:',
                components: [createTicketTypeMenu()],
                flags: 64
            });
        }

        if (interaction.customId === 'claim_ticket') {
            await claimTicket(interaction);
        }

        if (interaction.customId === 'unclaim_ticket') {
            await unclaimTicket(interaction);
        }

        if (interaction.customId === 'add_member') {
            if (!isAdmin(interaction.member)) {
                await interaction.reply({ 
                    content: '❌ لا تملك صلاحية لإضافة أعضاء! هذه الميزة للمسؤولين فقط.',
                    flags: 64
                });
                return;
            }
            await interaction.showModal(createAddMemberModal());
        }

        if (interaction.customId === 'rename_ticket') {
            if (!isAdmin(interaction.member)) {
                await interaction.reply({ 
                    content: '❌ لا تملك صلاحية لإعادة تسمية التذاكر! هذه الميزة للمسؤولين فقط.',
                    flags: 64
                });
                return;
            }
            await interaction.showModal(createRenameTicketModal());
        }

        if (interaction.customId === 'remind_member') {
            await remindMember(interaction);
        }

        if (interaction.customId === 'close_ticket') {
            if (!isAdmin(interaction.member)) {
                await interaction.reply({ 
                    content: '❌ لا تملك صلاحية لإغلاق التذاكر! هذه الميزة للمسؤولين فقط.',
                    flags: 64
                });
                return;
            }
            await interaction.reply({
                content: '📝 اختر سبب الإغلاق:',
                components: [createCloseReasonMenu()],
                flags: 64
            });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'add_member_modal') {
            if (!isAdmin(interaction.member)) {
                await interaction.reply({ 
                    content: '❌ لا تملك صلاحية لإضافة أعضاء! هذه الميزة للمسؤولين فقط.',
                    flags: 64
                });
                return;
            }
            const memberId = interaction.fields.getTextInputValue('member_id');
            await addMemberToTicket(interaction, memberId);
        }

        if (interaction.customId === 'rename_ticket_modal') {
            const newName = interaction.fields.getTextInputValue('new_name');
            await renameTicket(interaction, newName);
        }

        if (interaction.customId === 'custom_reason_modal') {
            const customReason = interaction.fields.getTextInputValue('custom_reason');
            await closeTicket(interaction, customReason);
        }

        if (interaction.customId === 'reminder_modal') {
            await handleReminderModal(interaction);
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup-tickets' && isAdmin(message.member)) {
        await createTicketPanel();
        await message.reply('✅ تم إعداد بانل التذاكر بنجاح!');
    }

    if (message.content === '!delete-all-tickets' && isAdmin(message.member)) {
        await deleteAllTickets(message);
    }
});

client.login(CONFIG.DISCORD_TOKEN);