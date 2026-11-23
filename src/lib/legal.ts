/**
 * Privacy policy and terms: one source for both the app pages (/privacy, /terms) and the static HTML
 * copies the build writes for crawlers such as Google's OAuth verification, which read pages without
 * running JavaScript. Plain strings only: URLs and email addresses inside them become links.
 *
 * Written to meet the Google API Services User Data Policy (including its Limited Use requirements)
 * and the Kenya Data Protection Act, 2019.
 */
export type LegalSettings = {
  supportEmail: string | null
  supportPhone: string | null
  platformFee: number
  refundWindowMinutes: number
  draftLifetimeMinutes: number
}

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[]; after?: string[] }
export type LegalDoc = { title: string; description: string; updated: string; intro: string; sections: LegalSection[] }

export const SITE_URL = 'https://campus.waren.digital'
export const LEGAL_UPDATED = '23 November 2026'

const contact = (s: LegalSettings) => [
  s.supportEmail ? `Email: ${s.supportEmail}` : `Contact form: ${SITE_URL}/contact`,
  ...(s.supportPhone ? [`Phone: ${s.supportPhone}`] : []),
]

export function privacyPolicy(s: LegalSettings): LegalDoc {
  return {
    title: 'Privacy policy',
    description: 'How Campus Food collects, uses, shares, protects and deletes personal data, including data received through Google sign-in.',
    updated: LEGAL_UPDATED,
    intro: `This policy explains how Campus Food (${SITE_URL}) collects, uses, shares, stores, protects and deletes personal data when you use our website, our WhatsApp service or our phone receptionist. It also explains exactly how we handle the information we receive from your Google Account when you choose "Continue with Google".`,
    sections: [
      {
        heading: '1. Who we are',
        paragraphs: [
          'Campus Food is a food-ordering platform for Kisii University and the surrounding area. It connects students, staff and visitors with verified hotels and student sellers, takes payment through M-PESA directly to each hotel, and tracks delivery.',
          'Campus Food is the data controller for the personal data described here. We process it under the Kenya Data Protection Act, 2019.',
        ],
      },
      {
        heading: '2. Information we collect',
        list: [
          'Account details you give us: your name, email address, M-PESA phone number and, if you choose, a profile photo.',
          'Google sign-in data (only if you choose "Continue with Google"): your name, email address, profile picture and Google account identifier. See section 3.',
          'Order details: the items you order, the hotel, your delivery area and the delivery location or room you type, delivery instructions, order status and receipts.',
          'Payment records from Safaricom M-PESA: amount, M-PESA receipt number, the phone number that paid and the result. We never see or store your M-PESA PIN.',
          'Messages and calls: what you send us on WhatsApp, call-back requests, and, if you use the voice receptionist, the audio and transcript of that call.',
          'Feedback and reviews you choose to send us.',
          'Technical data: your device and browser type, and the settings saved in your browser (such as your theme, cart and sign-in session). We do not use advertising cookies or third-party trackers.',
        ],
      },
      {
        heading: '3. Data we receive from Google',
        paragraphs: [
          'If you sign in with Google, we request only the basic scopes "openid", "email" and "profile". With them, Google shares your name, email address, profile picture and a Google account identifier. We do not request access to your Gmail, Google Drive, Contacts, Calendar or any other Google data.',
          'We use this information only to:',
        ],
        list: [
          'create your Campus Food account and sign you in securely;',
          'show your name and picture on your account, and put your name on your orders so the hotel and rider can serve you;',
          'send order receipts and service messages to your email address.',
        ],
        after: [
          'Campus Food’s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.',
          'In particular, we do not sell Google user data; we do not use or transfer it for advertising, retargeting, credit-worthiness or lending; we do not use it to train artificial-intelligence models; and no person reads it except where you ask for help, where it is needed for security or to investigate abuse, or where the law requires it. We share it only as described in section 5, to provide the service you asked for.',
          'You can remove Campus Food’s access to your Google Account at any time at https://myaccount.google.com/permissions. Google’s own handling of your data is described in the Google Privacy Policy (https://policies.google.com/privacy) and the Google Terms of Service (https://policies.google.com/terms).',
        ],
      },
      {
        heading: '4. How we use your information',
        list: [
          'To take your order, send it to the hotel you chose, collect payment through M-PESA and deliver it.',
          'To send order confirmations, receipts and status updates by SMS, email and, if you opt in, WhatsApp.',
          'To handle cancellations, refunds, complaints and support requests, including call-backs.',
          'To keep accounting and tax records that the law requires.',
          'To keep the platform secure: preventing fraud, abuse and unauthorised access.',
          'To improve the service using totals and trends (for example, which dishes sell most), not individual profiles.',
        ],
        after: ['We use your data only for these purposes. We do not sell personal data, and we do not use it for third-party advertising.'],
      },
      {
        heading: '5. Who we share it with',
        list: [
          'The hotel or seller you order from: your name, phone number, delivery location and order, so they can prepare and deliver it.',
          'The rider assigned to your order: what they need to deliver it (name, phone, delivery location).',
          'Service providers who process data for us under contract and only on our instructions: Supabase (database, sign-in and file storage), Vercel (website hosting), Safaricom M-PESA (payments), Africa’s Talking (SMS), Meta WhatsApp (optional messages), ElevenLabs (voice receptionist calls), Google Gemini (answering WhatsApp and support questions) and our email delivery provider.',
          'Authorities, when the law requires it, or to protect the rights and safety of our users.',
        ],
        after: [
          'Some of these providers store data outside Kenya. Where they do, we rely on the safeguards the Data Protection Act requires, such as contractual protections.',
          'The live order pop-ups on our home page show only a dish, the delivery area (for example a hostel name) and the order stage. They never show names, phone numbers, rooms or amounts.',
        ],
      },
      {
        heading: '6. How long we keep it',
        list: [
          `Unpaid draft orders are deleted after ${Math.max(1, Math.round(s.draftLifetimeMinutes / 60))} hours.`,
          'Paid orders, payments and refunds are kept for as long as Kenyan law requires for financial records (generally seven years), then deleted or anonymised.',
          'Your account details, including data from Google sign-in, are kept while your account is open and deleted within 30 days after you ask us to close it, except records we must keep by law.',
          'Voice-call recordings and transcripts are kept only as long as needed to resolve your request and improve the receptionist’s answers, then deleted.',
        ],
      },
      {
        heading: '7. Your rights and deleting your data',
        paragraphs: [
          'Under the Kenya Data Protection Act, 2019, you have the right to be told how your data is used, to see it, to correct it, to have it deleted, to object to its use, and to receive a copy of it.',
          'You can change your name, phone number, photo and message choices yourself under Account. To get a copy of your data, or to delete your account and all data received from Google, contact us using the details in section 11. We will act on your request within 30 days.',
          'If you are not satisfied with our answer, you may complain to the Office of the Data Protection Commissioner (https://www.odpc.go.ke).',
        ],
      },
      {
        heading: '8. Security',
        list: [
          'All traffic is encrypted with HTTPS.',
          'Database access rules make sure each person, hotel and rider can see only the records they need.',
          'Staff and administrator accounts require two-step verification.',
          'Payments are confirmed only by Safaricom’s own response, never by the person paying.',
          'We will never ask for your password, M-PESA PIN or sign-in code.',
        ],
      },
      {
        heading: '9. Children',
        paragraphs: ['Campus Food is meant for university students, staff and adults. It is not directed at children under 18, and we do not knowingly collect their data. If you believe a child has given us data, contact us and we will delete it.'],
      },
      {
        heading: '10. Changes to this policy',
        paragraphs: ['If we change how we use your data, we will update this page and the date at the top. If a change is significant, we will tell you by email or in the app before it takes effect.'],
      },
      { heading: '11. Contact us', paragraphs: ['For privacy questions, requests to see or delete your data, or complaints:'], list: contact(s) },
    ],
  }
}

export function termsOfService(s: LegalSettings): LegalDoc {
  return {
    title: 'Terms of service',
    description: 'The terms for ordering food, paying by M-PESA, refunds and delivery on Campus Food.',
    updated: LEGAL_UPDATED,
    intro: `These terms govern your use of Campus Food (${SITE_URL}), our WhatsApp service and our phone receptionist. By creating an account or placing an order you agree to them. Please also read our privacy policy (${SITE_URL}/privacy).`,
    sections: [
      {
        heading: '1. The service',
        paragraphs: ['Campus Food lets you order food from verified hotels and student sellers near Kisii University, pay them directly through M-PESA and follow your order until it is delivered. Each hotel or seller prepares its own food and is responsible for its quality and safety.'],
      },
      {
        heading: '2. Your account',
        list: [
          'You may sign up with your email address or with your Google Account. If you use Google, Google’s own terms (https://policies.google.com/terms) also apply to your Google Account.',
          'You must give accurate details, including a working phone number and delivery location.',
          'Keep your sign-in details private. You are responsible for orders placed from your account.',
          'You must be at least 18 years old, or have the consent of a parent or guardian.',
        ],
      },
      {
        heading: '3. Prices and fees',
        paragraphs: [
          'Food prices are set by each hotel and confirmed when you place the order. We do not add a markup to food prices.',
          `We charge a flat platform fee per order (currently KES ${Math.round(s.platformFee)}; some student sellers carry no fee) and a delivery fee for your delivery area. The full breakdown is shown before you pay.`,
        ],
      },
      {
        heading: '4. Payment',
        paragraphs: ['You pay through an M-PESA prompt sent to your phone, and the money goes directly to the hotel’s Paybill or Till. An order counts as paid only when Safaricom confirms the payment. One order is paid to one hotel.'],
      },
      {
        heading: '5. Cancellations and refunds',
        list: [
          'You may cancel an unpaid order at any time.',
          `After paying, you may ask for a refund within ${s.refundWindowMinutes} minutes, before the hotel starts preparing your food.`,
          'If a hotel rejects your order, you are refunded in full.',
          'Approved refunds are reversed to the M-PESA number that paid.',
        ],
      },
      {
        heading: '6. Delivery',
        paragraphs: ['Delivery times are estimates and update as the hotel and rider make progress. Please be reachable on the phone number you gave. If we cannot reach you after reasonable attempts, the order may be treated as delivered.'],
      },
      {
        heading: '7. Acceptable use',
        list: [
          'Do not place fake orders, misuse payments or refunds, or harass hotels, riders or staff.',
          'Do not try to access other people’s accounts or data, or to disrupt or reverse-engineer the platform.',
          'We may suspend or close accounts that break these terms or are used for fraud.',
        ],
      },
      {
        heading: '8. Hotels and sellers',
        paragraphs: ['Hotels and sellers are registered and verified by Campus Food, including a test M-PESA payment, before they can sell. They manage their own menus, prices, photos and availability, and must follow food-safety and consumer-protection law.'],
      },
      {
        heading: '9. Liability',
        paragraphs: ['We work to keep Campus Food available and accurate, but we cannot promise it will always be free of interruptions or errors. To the extent the law allows, our liability for any order is limited to the amount you paid for it. Nothing in these terms limits rights you have under the Consumer Protection Act, 2012.'],
      },
      {
        heading: '10. Changes and governing law',
        paragraphs: ['We may update these terms; the date at the top shows the latest version, and significant changes will be announced in the app. These terms are governed by the laws of Kenya.'],
      },
      { heading: '11. Contact us', paragraphs: ['Questions about these terms:'], list: contact(s) },
    ],
  }
}

/** Splits text into plain parts and links (https URLs and email addresses), for both renderers. */
export function linkify(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = []
  const re = /(https?:\/\/[^\s)]+[^\s).,;])|([\w.+-]+@[\w-]+\.[\w.-]*\w)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], href: m[1] ? m[0] : `mailto:${m[0]}` })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const html = (t: string) => linkify(t).map((p) => (p.href ? `<a href="${esc(p.href)}">${esc(p.text)}</a>` : esc(p.text))).join('')

/** Static HTML of a legal document (placed inside #root; React replaces it when the app starts). */
export function legalHtml(doc: LegalDoc): string {
  const body = doc.sections.map((s) => [
    `<h2>${esc(s.heading)}</h2>`,
    ...(s.paragraphs ?? []).map((p) => `<p>${html(p)}</p>`),
    s.list ? `<ul>${s.list.map((l) => `<li>${html(l)}</li>`).join('')}</ul>` : '',
    ...(s.after ?? []).map((p) => `<p>${html(p)}</p>`),
  ].join('')).join('\n')
  return `<main style="max-width:48rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif;line-height:1.6"><p><a href="/">Campus Food</a></p><h1>${esc(doc.title)}</h1><p><em>Last updated ${esc(doc.updated)}</em></p><p>${html(doc.intro)}</p>\n${body}</main>`
}

/**
 * The home page as plain HTML (inside #root of index.html, replaced by the app when it starts). It lets anyone,
 * including Google's OAuth verification, read what Campus Food is, without signing in or running JavaScript, and links
 * to the privacy policy and terms.
 */
export function homeHtml(s: LegalSettings): string {
  const fee = Math.round(s.platformFee)
  return `<main style="max-width:48rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif;line-height:1.6">
<p><img src="/brand/campus-food-mark.svg" alt="Campus Food logo" width="64" height="64" /></p>
<h1>Campus Food</h1>
<p><strong>Campus Food is a food-ordering and delivery app for Kisii University, Kenya.</strong> Students, staff and visitors order meals from verified hotels and student sellers near campus, pay the hotel directly by M-PESA, and follow the order until it is delivered to their hostel, office or gate.</p>
<h2>What you can do with Campus Food</h2>
<ul>
<li>Browse the live menus of verified campus hotels, at each hotel’s own prices, without signing in.</li>
<li>Order and pay through an M-PESA prompt on your phone; the money goes straight to the hotel’s Paybill or Till.</li>
<li>Track your order as it is accepted, cooked, picked up and delivered, and get a receipt by SMS and email.</li>
<li>Ask for a refund within ${s.refundWindowMinutes} minutes of paying, before the kitchen starts cooking.</li>
<li>Talk to our receptionist by phone or WhatsApp for help with an order.</li>
</ul>
<p>Prices: food at the hotel’s menu price with no markup, a flat platform fee of KES ${fee} per order, and a delivery fee for your area, all shown before you pay.</p>
<h2>Signing in, and how we use your Google data</h2>
<p>You can browse without an account. To order, you sign in with your email address or with “Continue with Google”. If you use Google, Campus Food receives only your name, email address and profile picture. We use them only to create your account, sign you in, put your name on your orders and send your receipts. We never sell this data or use it for advertising. Full details are in our <a href="/privacy">privacy policy</a>.</p>
<p><a href="/menu">Browse today’s menu</a> · <a href="/about">About Campus Food</a> · <a href="/contact">Contact us</a></p>
<p><a href="/privacy">Privacy policy</a> · <a href="/terms">Terms of service</a></p>
</main>`
}
