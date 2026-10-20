import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/shared/PageHeader'
import Tabs from '../../components/ui/Tabs'

// Each role's guide in English and Urdu. Page names stay in English so they match the sidebar.
// Keep both languages in step with NAV (lib/navigation.js) when a page is added or removed.
const ANALYTICS = {
  en: 'Movement, balances, requests and approvals, with Excel and PDF reports.',
  ur: 'آمد و رفت، بیلنس، درخواستیں اور منظوریاں، Excel اور PDF رپورٹس کے ساتھ۔',
}
const REGISTER = {
  en: 'Every vial in and out of the store, with the running balance.',
  ur: 'اسٹور میں آنے اور جانے والا ہر وائل، چلتے بیلنس کے ساتھ۔',
}

const GUIDE = {
  super_admin: {
    en: {
      label: 'Super Admin',
      tagline: 'Set up the network, the accounts and the vaccine list, and watch stock everywhere.',
      purpose: 'You are the only role that can see and change everything. You build the districts, union councils and facilities, create every account, keep the vaccine list, and monitor stock across all facilities.',
      responsibilities: [
        'Create districts, towns, union councils and facilities',
        'Create, activate and deactivate every account, and reset passwords',
        'Assign UC Supervisors to their union councils',
        'Keep the vaccine list: doses per vial and the default thresholds',
        'Set custom thresholds for a facility that needs them',
      ],
      workflow: [
        ['Build the network', 'Add a district, its towns and union councils, then the facilities under each union council.'],
        ['Create accounts', 'Add supervisors, Facility Heads, vaccinators and Observers, each tied to their district, union council or facility.'],
        ['Set up vaccines', 'Enter doses per vial and the critical and low thresholds.'],
        ['Monitor', 'Check the dashboard daily for Critical and Low stock; use Analytics and the Audit Log for detail.'],
      ],
      modules: [
        ['Dashboard', 'Stock status of every facility.'],
        ['Districts', 'Add, rename or deactivate districts; open one to see its facilities.'],
        ['Union Councils', 'Manage towns and union councils.'],
        ['Facilities', 'Add and manage facilities; open one for its stock and custom thresholds.'],
        ['Vaccines', 'The vaccine list, doses per vial and default thresholds.'],
        ['Users', 'Every account: create, deactivate, reset password, reassign union councils.'],
        ['Audit Log', 'Every action in the system: who did what, and when.'],
        ['Analytics', ANALYTICS.en],
      ],
    },
    ur: {
      label: 'سپر ایڈمن',
      tagline: 'نیٹ ورک، اکاؤنٹس اور ویکسین کی فہرست بنائیں، اور ہر جگہ اسٹاک پر نظر رکھیں۔',
      purpose: 'آپ واحد کردار ہیں جو سب کچھ دیکھ اور تبدیل کر سکتا ہے۔ آپ اضلاع، یونین کونسلیں اور فیسلٹیز بناتے ہیں، ہر اکاؤنٹ بناتے ہیں، ویکسین کی فہرست سنبھالتے ہیں اور تمام فیسلٹیز کے اسٹاک کی نگرانی کرتے ہیں۔',
      responsibilities: [
        'اضلاع، ٹاؤن، یونین کونسلیں اور فیسلٹیز بنانا',
        'ہر اکاؤنٹ بنانا، فعال یا غیر فعال کرنا، اور پاس ورڈ ری سیٹ کرنا',
        'یو سی سپروائزرز کو ان کی یونین کونسلیں تفویض کرنا',
        'ویکسین کی فہرست سنبھالنا: فی وائل خوراکیں اور ڈیفالٹ تھریش ہولڈز',
        'ضرورت ہو تو کسی فیسلٹی کے لیے الگ تھریش ہولڈز مقرر کرنا',
      ],
      workflow: [
        ['نیٹ ورک بنائیں', 'ضلع، اس کے ٹاؤن اور یونین کونسلیں شامل کریں، پھر ہر یونین کونسل کے تحت فیسلٹیز۔'],
        ['اکاؤنٹس بنائیں', 'سپروائزرز، فیسلٹی ہیڈز، ویکسینیٹرز اور آبزرورز شامل کریں، اور ہر ایک کو اس کے ضلع، یونین کونسل یا فیسلٹی سے منسلک کریں۔'],
        ['ویکسینز ترتیب دیں', 'فی وائل خوراکیں اور Critical اور Low کے تھریش ہولڈز درج کریں۔'],
        ['نگرانی کریں', 'روزانہ ڈیش بورڈ پر Critical اور Low اسٹاک دیکھیں؛ تفصیل کے لیے Analytics اور Audit Log استعمال کریں۔'],
      ],
      modules: [
        ['Dashboard', 'ہر فیسلٹی کے اسٹاک کی صورتحال۔'],
        ['Districts', 'اضلاع شامل کریں، نام بدلیں یا غیر فعال کریں؛ کسی ضلع کو کھول کر اس کی فیسلٹیز دیکھیں۔'],
        ['Union Councils', 'ٹاؤن اور یونین کونسلوں کا انتظام۔'],
        ['Facilities', 'فیسلٹیز شامل کریں اور ان کا انتظام کریں؛ کسی فیسلٹی کو کھول کر اس کا اسٹاک اور الگ تھریش ہولڈز دیکھیں۔'],
        ['Vaccines', 'ویکسین کی فہرست، فی وائل خوراکیں اور ڈیفالٹ تھریش ہولڈز۔'],
        ['Users', 'تمام اکاؤنٹس: بنانا، غیر فعال کرنا، پاس ورڈ ری سیٹ کرنا، یونین کونسلیں دوبارہ تفویض کرنا۔'],
        ['Audit Log', 'سسٹم میں ہر کارروائی: کس نے کیا کیا، اور کب۔'],
        ['Analytics', ANALYTICS.ur],
      ],
    },
  },

  observer: {
    en: {
      label: 'Observer',
      tagline: 'See everything the Super Admin sees. Change nothing.',
      purpose: 'You monitor stock across every district and facility for reporting. Every create, edit and approve button is hidden for you.',
      responsibilities: [
        'Watch stock status across the whole system',
        'Review Analytics and the Audit Log',
        'Report what you find to the team responsible',
      ],
      workflow: [
        ['Scan the dashboard', 'Find facilities with Critical or Low stock.'],
        ['Open the detail', 'Open a district or facility to see each vaccine.'],
        ['Check the history', 'Use Analytics and the Audit Log to see what happened.'],
        ['Report', 'Share your findings outside the system.'],
      ],
      modules: [
        ['Dashboard', 'Stock status of every facility.'],
        ['Districts', 'Every district and its facilities.'],
        ['Union Councils', 'Every town and union council.'],
        ['Facilities', "Any facility's stock of each vaccine."],
        ['Vaccines', 'The vaccine list and its thresholds.'],
        ['Users', 'Every account in the system.'],
        ['Audit Log', 'Every action in the system.'],
        ['Analytics', ANALYTICS.en],
      ],
    },
    ur: {
      label: 'آبزرور',
      tagline: 'سپر ایڈمن جو کچھ دیکھتا ہے وہ سب دیکھیں، مگر کچھ تبدیل نہ کریں۔',
      purpose: 'آپ رپورٹنگ کے لیے ہر ضلع اور فیسلٹی کے اسٹاک کی نگرانی کرتے ہیں۔ بنانے، تبدیل کرنے اور منظوری کے تمام بٹن آپ کے لیے چھپے ہوئے ہیں۔',
      responsibilities: [
        'پورے سسٹم میں اسٹاک کی صورتحال پر نظر رکھنا',
        'Analytics اور Audit Log کا جائزہ لینا',
        'اپنی معلومات متعلقہ ٹیم تک پہنچانا',
      ],
      workflow: [
        ['ڈیش بورڈ دیکھیں', 'Critical یا Low اسٹاک والی فیسلٹیز تلاش کریں۔'],
        ['تفصیل کھولیں', 'ہر ویکسین دیکھنے کے لیے کوئی ضلع یا فیسلٹی کھولیں۔'],
        ['تاریخ دیکھیں', 'کیا ہوا، یہ جاننے کے لیے Analytics اور Audit Log استعمال کریں۔'],
        ['رپورٹ کریں', 'اپنی معلومات سسٹم سے باہر شیئر کریں۔'],
      ],
      modules: [
        ['Dashboard', 'ہر فیسلٹی کے اسٹاک کی صورتحال۔'],
        ['Districts', 'ہر ضلع اور اس کی فیسلٹیز۔'],
        ['Union Councils', 'ہر ٹاؤن اور یونین کونسل۔'],
        ['Facilities', 'کسی بھی فیسلٹی میں ہر ویکسین کا اسٹاک۔'],
        ['Vaccines', 'ویکسین کی فہرست اور اس کے تھریش ہولڈز۔'],
        ['Users', 'سسٹم کے تمام اکاؤنٹس۔'],
        ['Audit Log', 'سسٹم میں ہر کارروائی۔'],
        ['Analytics', ANALYTICS.ur],
      ],
    },
  },

  district_supervisor: {
    en: {
      label: 'District Supervisor',
      tagline: 'Watch stock across your district.',
      purpose: 'You monitor every facility in your district. Your screens are view-only: the Super Admin creates facilities and accounts, and stock requests are handled by the UC Supervisor, Facility Supervisor and Facility Head.',
      responsibilities: [
        'Check stock status across your district every day',
        'Follow up with facilities that show Critical or Low stock',
        'Review activity and trends in the Audit Log and Analytics',
      ],
      workflow: [
        ['Check the dashboard', 'See which facilities are Critical, Low or Not updated.'],
        ['Find the facility', 'Use Network to browse towns and union councils, or Facilities to search.'],
        ['Follow up', 'Contact the facility or its UC Supervisor about low stock.'],
        ['Review', 'Use Analytics for trends and reports.'],
      ],
      modules: [
        ['Dashboard', 'Stock status across your district.'],
        ['Network', 'Your towns, union councils and their facilities.'],
        ['Facilities', 'Every facility in your district, with its stock.'],
        ['Users', 'The staff in your district (view only).'],
        ['Audit Log', 'Activity in your district.'],
        ['Analytics', ANALYTICS.en],
      ],
    },
    ur: {
      label: 'ڈسٹرکٹ سپروائزر',
      tagline: 'اپنے ضلع میں اسٹاک پر نظر رکھیں۔',
      purpose: 'آپ اپنے ضلع کی ہر فیسلٹی کی نگرانی کرتے ہیں۔ آپ کی اسکرینز صرف دیکھنے کے لیے ہیں: فیسلٹیز اور اکاؤنٹس سپر ایڈمن بناتا ہے، اور اسٹاک کی درخواستیں یو سی سپروائزر، فیسلٹی سپروائزر اور فیسلٹی ہیڈ نمٹاتے ہیں۔',
      responsibilities: [
        'روزانہ اپنے ضلع میں اسٹاک کی صورتحال دیکھنا',
        'Critical یا Low اسٹاک والی فیسلٹیز سے رابطہ کرنا',
        'Audit Log اور Analytics میں سرگرمی اور رجحانات کا جائزہ لینا',
      ],
      workflow: [
        ['ڈیش بورڈ دیکھیں', 'دیکھیں کون سی فیسلٹیز Critical، Low یا Not updated ہیں۔'],
        ['فیسلٹی تلاش کریں', 'ٹاؤن اور یونین کونسلیں دیکھنے کے لیے Network، یا تلاش کے لیے Facilities استعمال کریں۔'],
        ['رابطہ کریں', 'کم اسٹاک کے بارے میں فیسلٹی یا اس کے یو سی سپروائزر سے بات کریں۔'],
        ['جائزہ لیں', 'رجحانات اور رپورٹس کے لیے Analytics استعمال کریں۔'],
      ],
      modules: [
        ['Dashboard', 'آپ کے ضلع میں اسٹاک کی صورتحال۔'],
        ['Network', 'آپ کے ٹاؤن، یونین کونسلیں اور ان کی فیسلٹیز۔'],
        ['Facilities', 'آپ کے ضلع کی ہر فیسلٹی اور اس کا اسٹاک۔'],
        ['Users', 'آپ کے ضلع کا عملہ (صرف دیکھنے کے لیے)۔'],
        ['Audit Log', 'آپ کے ضلع میں سرگرمی۔'],
        ['Analytics', ANALYTICS.ur],
      ],
    },
  },

  uc_supervisor: {
    en: {
      label: 'UC Supervisor',
      tagline: 'Send stock to the facilities in your union councils and record what you sent.',
      purpose: 'When a facility in your union councils raises a stock request, you hand over the stock and record what you sent. The rest of the time you monitor those facilities.',
      responsibilities: [
        'Record what you sent for each stock request, in vials per vaccine',
        'Decline a request, with a reason, if you cannot send it',
        'Watch stock at the facilities in your union councils',
      ],
      workflow: [
        ['Request arrives', 'A facility raises a stock request and you are notified.'],
        ['Hand over the stock', 'Give the facility the vaccines.'],
        ['Record sent', 'Enter the vials sent for each vaccine. They can differ from what was asked for.'],
        ['Facility records received', 'The Facility Supervisor enters what arrived. When sent and received match, the Facility Head approves and the stock enters the store.'],
      ],
      modules: [
        ['Dashboard', 'Stock status at the facilities in your union councils.'],
        ['Facilities', "Each facility's stock of each vaccine."],
        ['Stock Requests', 'Record what you sent, or decline a request.'],
        ['Users', 'Staff at your facilities (view only).'],
        ['Audit Log', 'Activity in your union councils.'],
        ['Analytics', ANALYTICS.en],
      ],
    },
    ur: {
      label: 'یو سی سپروائزر',
      tagline: 'اپنی یونین کونسلوں کی فیسلٹیز کو اسٹاک بھیجیں اور بھیجی گئی مقدار درج کریں۔',
      purpose: 'جب آپ کی یونین کونسل کی کوئی فیسلٹی اسٹاک کی درخواست کرتی ہے تو آپ اسٹاک حوالے کرتے ہیں اور درج کرتے ہیں کہ کیا بھیجا۔ باقی وقت آپ ان فیسلٹیز کی نگرانی کرتے ہیں۔',
      responsibilities: [
        'ہر درخواست کے لیے بھیجا گیا اسٹاک درج کرنا، ہر ویکسین کے وائلز میں',
        'اگر اسٹاک نہ بھیج سکیں تو وجہ کے ساتھ درخواست مسترد (Decline) کرنا',
        'اپنی یونین کونسلوں کی فیسلٹیز میں اسٹاک پر نظر رکھنا',
      ],
      workflow: [
        ['درخواست آتی ہے', 'فیسلٹی اسٹاک کی درخواست کرتی ہے اور آپ کو اطلاع ملتی ہے۔'],
        ['اسٹاک حوالے کریں', 'فیسلٹی کو ویکسینز دیں۔'],
        ['بھیجا گیا درج کریں', 'ہر ویکسین کے بھیجے گئے وائلز درج کریں۔ یہ مانگی گئی مقدار سے مختلف ہو سکتے ہیں۔'],
        ['فیسلٹی وصولی درج کرتی ہے', 'فیسلٹی سپروائزر درج کرتا ہے کہ کیا پہنچا۔ بھیجا گیا اور وصول شدہ برابر ہوں تو فیسلٹی ہیڈ منظوری دیتا ہے اور اسٹاک اسٹور میں شامل ہو جاتا ہے۔'],
      ],
      modules: [
        ['Dashboard', 'آپ کی یونین کونسلوں کی فیسلٹیز میں اسٹاک کی صورتحال۔'],
        ['Facilities', 'ہر فیسلٹی میں ہر ویکسین کا اسٹاک۔'],
        ['Stock Requests', 'بھیجا گیا اسٹاک درج کریں یا درخواست مسترد کریں۔'],
        ['Users', 'آپ کی فیسلٹیز کا عملہ (صرف دیکھنے کے لیے)۔'],
        ['Audit Log', 'آپ کی یونین کونسلوں میں سرگرمی۔'],
        ['Analytics', ANALYTICS.ur],
      ],
    },
  },

  facility_supervisor: {
    en: {
      label: 'Facility Supervisor',
      tagline: "Run your facility's stock every day: requests, the morning handout and day end.",
      purpose: "You manage your facility's store. You request stock, hand vials to vaccinators each morning and record what each one used at the end of the day. Stock only enters the store through an approved stock request.",
      note: 'Assign Vials and Day End work without signal: entries are saved on the phone and sent when you are back online. You can date an entry up to 7 days back.',
      responsibilities: [
        'Raise stock requests and record what arrived, with batch number, expiry date and manufacturer',
        'Assign vials to each vaccinator every morning',
        "Record each vaccinator's day end: used, returned and wasted",
        'Ask the Facility Head to approve a stock correction or a threshold change',
      ],
      workflow: [
        ['Request stock', 'Raise a stock request; the UC Supervisor and Facility Head are notified.'],
        ['Record received', 'When the stock arrives, enter the vials with batch number, expiry date and manufacturer.'],
        ['Facility Head approves', 'When sent and received match, the Head approves and the stock enters your store.'],
        ['Assign Vials (morning)', 'Hand each vaccinator their vials from the store.'],
        ['Day End (evening)', "Enter each vaccinator's used, returned and wasted vials. Together they must equal what the vaccinator held."],
      ],
      modules: [
        ['Dashboard', "Your facility's stock status."],
        ['Assign Vials', 'The morning handout to each vaccinator.'],
        ['Day End', 'Used, returned and wasted vials for each vaccinator.'],
        ['Approvals', 'Ask for a stock correction or threshold change; withdraw it if needed.'],
        ['Stock Requests', 'Raise requests, record received, cancel or close short.'],
        ['Stock Register', REGISTER.en],
        ['Audit Log', 'Everything done at your facility.'],
        ['Analytics', ANALYTICS.en],
        ['Vaccinators', 'The vaccinators at your facility (the Super Admin adds them).'],
      ],
    },
    ur: {
      label: 'فیسلٹی سپروائزر',
      tagline: 'روزانہ اپنی فیسلٹی کا اسٹاک چلائیں: درخواستیں، صبح کی تقسیم اور دن کا اختتام۔',
      purpose: 'آپ اپنی فیسلٹی کا اسٹور سنبھالتے ہیں۔ آپ اسٹاک کی درخواست کرتے ہیں، ہر صبح ویکسینیٹرز کو وائلز دیتے ہیں اور دن کے آخر میں درج کرتے ہیں کہ ہر ایک نے کیا استعمال کیا۔ اسٹاک صرف منظور شدہ درخواست کے ذریعے اسٹور میں آتا ہے۔',
      note: 'Assign Vials اور Day End سگنل کے بغیر بھی کام کرتے ہیں: اندراجات فون میں محفوظ ہو جاتے ہیں اور انٹرنیٹ واپس آنے پر بھیج دیے جاتے ہیں۔ آپ اندراج کی تاریخ 7 دن پیچھے تک رکھ سکتے ہیں۔',
      responsibilities: [
        'اسٹاک کی درخواست کرنا، اور جو پہنچا وہ بیچ نمبر، ایکسپائری تاریخ اور مینوفیکچرر کے ساتھ درج کرنا',
        'ہر صبح ہر ویکسینیٹر کو وائلز دینا',
        'ہر ویکسینیٹر کا دن کا اختتام درج کرنا: استعمال شدہ، واپس اور ضائع شدہ',
        'اسٹاک کی درستگی یا تھریش ہولڈ کی تبدیلی کے لیے فیسلٹی ہیڈ سے منظوری لینا',
      ],
      workflow: [
        ['اسٹاک کی درخواست', 'اسٹاک کی درخواست کریں؛ یو سی سپروائزر اور فیسلٹی ہیڈ کو اطلاع ملتی ہے۔'],
        ['وصولی درج کریں', 'اسٹاک پہنچنے پر وائلز کو بیچ نمبر، ایکسپائری تاریخ اور مینوفیکچرر کے ساتھ درج کریں۔'],
        ['فیسلٹی ہیڈ کی منظوری', 'بھیجا گیا اور وصول شدہ برابر ہوں تو ہیڈ منظوری دیتا ہے اور اسٹاک آپ کے اسٹور میں آ جاتا ہے۔'],
        ['Assign Vials (صبح)', 'اسٹور سے ہر ویکسینیٹر کو اس کے وائلز دیں۔'],
        ['Day End (شام)', 'ہر ویکسینیٹر کے استعمال شدہ، واپس اور ضائع شدہ وائلز درج کریں۔ ان کا مجموعہ اس کے پاس موجود وائلز کے برابر ہونا چاہیے۔'],
      ],
      modules: [
        ['Dashboard', 'آپ کی فیسلٹی کے اسٹاک کی صورتحال۔'],
        ['Assign Vials', 'ہر ویکسینیٹر کو صبح کی تقسیم۔'],
        ['Day End', 'ہر ویکسینیٹر کے استعمال شدہ، واپس اور ضائع شدہ وائلز۔'],
        ['Approvals', 'اسٹاک کی درستگی یا تھریش ہولڈ کی تبدیلی کی درخواست کریں؛ ضرورت ہو تو واپس لیں۔'],
        ['Stock Requests', 'درخواست کریں، وصولی درج کریں، منسوخ کریں یا کم مقدار پر بند کریں۔'],
        ['Stock Register', REGISTER.ur],
        ['Audit Log', 'آپ کی فیسلٹی پر ہونے والا ہر کام۔'],
        ['Analytics', ANALYTICS.ur],
        ['Vaccinators', 'آپ کی فیسلٹی کے ویکسینیٹرز (انہیں سپر ایڈمن شامل کرتا ہے)۔'],
      ],
    },
  },

  facility_head: {
    en: {
      label: 'Facility Head',
      tagline: "Approve your facility's stock and watch everything that happens there.",
      purpose: "You are your facility's approver. You approve stock requests once the sent and received figures match, and you approve or reject the Facility Supervisor's stock corrections and threshold changes.",
      note: 'You cannot reject a stock request, only approve it once the figures match. Settle any disagreement outside the system.',
      responsibilities: [
        'Approve stock requests when sent equals received',
        'Approve or reject stock corrections and threshold changes',
        'Watch the Stock Register and every action at your facility',
      ],
      workflow: [
        ['Get notified', 'A request is ready, or the Facility Supervisor asks for a correction or threshold change.'],
        ['Check the figures', 'For a stock request, confirm that sent equals received.'],
        ['Approve', 'Approved stock enters the store; an approved correction or threshold applies at once.'],
        ['Monitor', 'Check the dashboard, Stock Register and Audit Log.'],
      ],
      modules: [
        ['Dashboard', "Your facility's stock status."],
        ['Approvals', 'Approve or reject corrections and threshold changes.'],
        ['Stock Requests', 'Give the final approval once the figures match.'],
        ['Users', 'Staff at your facility (view only).'],
        ['Stock Register', REGISTER.en],
        ['Audit Log', 'Every action at your facility.'],
        ['Analytics', ANALYTICS.en],
      ],
    },
    ur: {
      label: 'فیسلٹی ہیڈ',
      tagline: 'اپنی فیسلٹی کے اسٹاک کی منظوری دیں اور وہاں ہونے والے ہر کام پر نظر رکھیں۔',
      purpose: 'آپ اپنی فیسلٹی میں منظوری دینے والے ہیں۔ بھیجا گیا اور وصول شدہ اسٹاک برابر ہونے پر آپ اسٹاک کی درخواست منظور کرتے ہیں، اور فیسلٹی سپروائزر کی اسٹاک کی درستگی اور تھریش ہولڈ کی تبدیلی منظور یا مسترد کرتے ہیں۔',
      note: 'آپ اسٹاک کی درخواست مسترد نہیں کر سکتے، صرف اعداد برابر ہونے پر منظور کر سکتے ہیں۔ اختلاف کی صورت میں معاملہ سسٹم سے باہر طے کریں۔',
      responsibilities: [
        'بھیجا گیا اور وصول شدہ برابر ہونے پر اسٹاک کی درخواستیں منظور کرنا',
        'اسٹاک کی درستگی اور تھریش ہولڈ کی تبدیلیاں منظور یا مسترد کرنا',
        'Stock Register اور اپنی فیسلٹی کی ہر کارروائی پر نظر رکھنا',
      ],
      workflow: [
        ['اطلاع ملتی ہے', 'کوئی درخواست تیار ہے، یا فیسلٹی سپروائزر نے درستگی یا تھریش ہولڈ کی تبدیلی مانگی ہے۔'],
        ['اعداد چیک کریں', 'اسٹاک کی درخواست میں تصدیق کریں کہ بھیجا گیا اور وصول شدہ برابر ہیں۔'],
        ['منظوری دیں', 'منظور شدہ اسٹاک اسٹور میں آ جاتا ہے؛ منظور شدہ درستگی یا تھریش ہولڈ فوراً لاگو ہو جاتا ہے۔'],
        ['نگرانی کریں', 'ڈیش بورڈ، Stock Register اور Audit Log دیکھیں۔'],
      ],
      modules: [
        ['Dashboard', 'آپ کی فیسلٹی کے اسٹاک کی صورتحال۔'],
        ['Approvals', 'درستگی اور تھریش ہولڈ کی تبدیلیاں منظور یا مسترد کریں۔'],
        ['Stock Requests', 'اعداد برابر ہونے پر حتمی منظوری دیں۔'],
        ['Users', 'آپ کی فیسلٹی کا عملہ (صرف دیکھنے کے لیے)۔'],
        ['Stock Register', REGISTER.ur],
        ['Audit Log', 'آپ کی فیسلٹی کی ہر کارروائی۔'],
        ['Analytics', ANALYTICS.ur],
      ],
    },
  },

  facility_worker: {
    en: {
      label: 'Vaccinator',
      tagline: 'See the vials you hold, what you used and what is left.',
      purpose: "Your Facility Supervisor gives you vials each morning and records your usage at the end of the day. You don't enter anything; this app shows you your numbers.",
      responsibilities: [
        'Check the vials you were given each morning',
        'Tell your supervisor at once if a number looks wrong',
      ],
      workflow: [
        ['Morning', 'Your supervisor assigns you vials.'],
        ['During the day', 'Give vaccinations.'],
        ['Evening', 'Your supervisor records what you used, returned and wasted.'],
        ['Any time', 'Open My Holdings to check your numbers.'],
      ],
      modules: [
        ['My Holdings', 'Vials given to you, used, returned, wasted and left.'],
        ['Stock Status', "Your facility's stock of each vaccine."],
      ],
    },
    ur: {
      label: 'ویکسینیٹر',
      tagline: 'دیکھیں آپ کے پاس کتنے وائلز ہیں، کتنے استعمال ہوئے اور کتنے باقی ہیں۔',
      purpose: 'آپ کا فیسلٹی سپروائزر ہر صبح آپ کو وائلز دیتا ہے اور دن کے آخر میں آپ کا استعمال درج کرتا ہے۔ آپ کو کچھ درج نہیں کرنا؛ یہ ایپ آپ کو آپ کے اعداد دکھاتی ہے۔',
      responsibilities: [
        'ہر صبح ملنے والے وائلز چیک کرنا',
        'کوئی عدد غلط لگے تو فوراً اپنے سپروائزر کو بتانا',
      ],
      workflow: [
        ['صبح', 'آپ کا سپروائزر آپ کو وائلز دیتا ہے۔'],
        ['دن بھر', 'ویکسینیشن کریں۔'],
        ['شام', 'آپ کا سپروائزر آپ کے استعمال شدہ، واپس اور ضائع شدہ وائلز درج کرتا ہے۔'],
        ['کسی بھی وقت', 'اپنے اعداد دیکھنے کے لیے My Holdings کھولیں۔'],
      ],
      modules: [
        ['My Holdings', 'آپ کو دیے گئے، استعمال شدہ، واپس، ضائع شدہ اور باقی وائلز۔'],
        ['Stock Status', 'آپ کی فیسلٹی میں ہر ویکسین کا اسٹاک۔'],
      ],
    },
  },
}

const UI = {
  en: { breadcrumb: 'Help › Guide', title: (l) => `${l} guide`, responsibilities: 'Your responsibilities', workflow: 'Your workflow', modules: 'Pages in your sidebar' },
  ur: { breadcrumb: 'مدد › رہنمائی', title: (l) => `${l} کے لیے رہنمائی`, responsibilities: 'آپ کی ذمہ داریاں', workflow: 'کام کا طریقہ', modules: 'سائیڈ بار کے صفحات' },
}

const LANG_KEY = 'sst_guide_lang'
const LANGS = [{ value: 'en', label: 'English' }, { value: 'ur', label: 'اردو' }]

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-text mb-3">{title}</h2>
      {children}
    </section>
  )
}

// Read-mode page: one column at a readable measure, plain headings, no icon tiles.
export default function DashboardGuide() {
  const { user } = useAuth()
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) === 'ur' ? 'ur' : 'en' } catch { return 'en' }
  })
  const g = (GUIDE[user?.role] ?? GUIDE.super_admin)[lang]
  const t = UI[lang]

  function changeLang(next) {
    setLang(next)
    try { localStorage.setItem(LANG_KEY, next) } catch { /* private mode */ }
  }

  return (
    <div className={`max-w-prose ${lang === 'ur' ? '[&_p]:leading-loose [&_li]:leading-loose [&_dd]:leading-loose' : ''}`} lang={lang} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      <PageHeader
        breadcrumb={t.breadcrumb}
        title={t.title(g.label)}
        subtitle={g.tagline}
        actions={<Tabs tabs={LANGS} value={lang} onChange={changeLang} size="sm" label="Language / زبان" />}
      />

      <p className="text-base text-text leading-relaxed">{g.purpose}</p>

      {g.note && (
        <p role="note" className="mt-5 rounded-control bg-warning-bg px-4 py-3 text-sm text-warning-dark leading-relaxed">{g.note}</p>
      )}

      <Section title={t.responsibilities}>
        <ul className="list-disc ps-5 flex flex-col gap-1.5 text-sm text-text leading-relaxed marker:text-text-muted">
          {g.responsibilities.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </Section>

      <Section title={t.workflow}>
        <ol className="flex flex-col gap-4">
          {g.workflow.map(([title, desc], i) => (
            <li key={title} className="flex gap-3.5">
              <span className="w-6 h-6 mt-px rounded-full bg-surface-chip text-text text-xs font-medium flex items-center justify-center flex-shrink-0 tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-text">{title}</p>
                <p className="text-sm text-text-muted mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t.modules}>
        <dl className="divide-y divide-surface-border border-y border-surface-border">
          {g.modules.map(([name, desc]) => (
            <div key={name} className="py-3 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-medium text-text">{name}</dt>
              <dd className="text-sm text-text-muted leading-relaxed mt-0.5 sm:mt-0">{desc}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  )
}
