/**
 * Funny, meme-style comments shown next to the score on the result page.
 *
 * - Failed attempt: 30 comments in 3 groups of 10, by attempt number (1st, 2nd, 3rd or later).
 * - Passed attempt: 10 comments for each 10% band of the score (up to 69, 70s, 80s, 90+).
 * One is picked at random each time. Hindi mode shows `hi` (Devanagari), English mode shows `en`
 * (Hinglish, because these jokes lose their punch when translated).
 * The jokes are about the score and the effort, never about the student.
 */

export interface ResultComment {
  hi: string;
  en: string;
}

const c = (en: string, hi: string): ResultComment => ({ en, hi });

/** Failed on the 1st attempt */
const FAIL_FIRST: ResultComment[] = [
  c('Oofooo! Isme to mujhe kuch samajh hi nahi aa raha hai... aur tujhe bhi nahi aaya, marks bata rahe hain.', 'ओफ्फो! इसमें तो मुझे कुछ समझ ही नहीं आ रहा है... और तुझे भी नहीं आया, नंबर बता रहे हैं।'),
  c('Kaise hua? Kab hua? Kyun hua? Arre bhai, padha hi nahi tha!', 'कैसे हुआ? कब हुआ? क्यों हुआ? अरे भाई, पढ़ा ही नहीं था!'),
  c('Itna sannata kyun hai bhai? Oh wait, ye to tere marks hain.', 'इतना सन्नाटा क्यों है भाई? ओह वेट, ये तो तेरे नंबर हैं।'),
  c('Aal izz well? Nahi bhai, aal izz not well. Pehle explanation padh le.', 'ऑल इज़ वेल? नहीं भाई, ऑल इज़ नॉट वेल। पहले एक्सप्लेनेशन पढ़ ले।'),
  c('Pehla attempt hai, maaf kiya. Doosre me yehi haal raha to Sharma ji ka beta hasega.', 'पहला attempt है, माफ़ किया। दूसरे में यही हाल रहा तो शर्मा जी का बेटा हँसेगा।'),
  c('Test de raha tha ya lottery khel raha tha? Option chunte waqt aankhein band thi kya?', 'टेस्ट दे रहा था या लॉटरी खेल रहा था? ऑप्शन चुनते वक़्त आँखें बंद थीं क्या?'),
  c('Dekh raha hai Binod! Tune kitab khole bina test de diya.', 'देख रहा है बिनोद! तूने किताब खोले बिना टेस्ट दे दिया।'),
  c('Result dekh ke chai thandi ho gayi. Nayi chai bana aur explanation khol.', 'रिज़ल्ट देखकर चाय ठंडी हो गई। नई चाय बना और एक्सप्लेनेशन खोल।'),
  c('Beta tumse na ho payega... arre mazak! Ek aur attempt maar, ho jayega.', 'बेटा तुमसे न हो पाएगा... अरे मज़ाक! एक और attempt मार, हो जाएगा।'),
  c('Mere paas gaadi hai, bangla hai, balance hai... tere paas kya hai? Explanation page hai, padh le.', 'मेरे पास गाड़ी है, बंगला है, बैलेंस है... तेरे पास क्या है? एक्सप्लेनेशन पेज है, पढ़ ले।'),
];

/** Failed on the 2nd attempt */
const FAIL_SECOND: ResultComment[] = [
  c('Doosra attempt, wahi haal. Ye dosti hum nahi todenge, keh raha hai fail se!', 'दूसरा attempt, वही हाल। ये दोस्ती हम नहीं तोड़ेंगे, कह रहा है फेल से!'),
  c('Kya se kya ho gaya... par marks wahi ke wahi rahe. Oofooo!', 'क्या से क्या हो गया... पर नंबर वही के वही रहे। ओफ्फो!'),
  c('Aise kaise chalega Baburao? Doosra attempt aur wahi score!', 'ऐसे कैसे चलेगा बाबू राव? दूसरा attempt और वही स्कोर!'),
  c('Ghar walon ne kitab ke paise diye the, sirf shelf pe sajane ke liye nahi!', 'घरवालों ने किताब के पैसे दिए थे, सिर्फ़ शेल्फ़ पर सजाने के लिए नहीं!'),
  c('Do attempt, do baar fail. Teesri baar kuch alag kar, kam se kam kitab khol ke to dekh.', 'दो attempt, दो बार फेल। तीसरी बार कुछ अलग कर, कम से कम किताब खोलकर तो देख।'),
  c('Tera study time-table kahin Instagram reels ke andar to nahi chhupa hai?', 'तेरा स्टडी टाइम-टेबल कहीं इंस्टाग्राम रील्स के अंदर तो नहीं छुपा है?'),
  c('Rasode me kaun tha? Chhod, ye bata padhai me kaun tha? Koi nahi!', 'रसोड़े में कौन था? छोड़, ये बता पढ़ाई में कौन था? कोई नहीं!'),
  c('Hum nahi sudhrenge! Kya yehi tera motto hai bhai?', 'हम नहीं सुधरेंगे! क्या यही तेरा मोटो है भाई?'),
  c('Is score pe to rank bhi muh chhupa leti hai.', 'इस स्कोर पर तो रैंक भी मुँह छुपा लेती है।'),
  c('Doosra fail! Ab sirf test nahi, explanation page pe bhi 10 minute bita.', 'दूसरा फेल! अब सिर्फ़ टेस्ट नहीं, एक्सप्लेनेशन पेज पर भी 10 मिनट बिता।'),
];

/** Failed on the 3rd attempt or later */
const FAIL_THIRD: ResultComment[] = [
  c('Teen attempt, teeno me yehi. Sarkari naukri keh rahi hai: "Main intezaar kar rahi hoon, par itna bhi nahi."', 'तीन attempt, तीनों में यही। सरकारी नौकरी कह रही है: "मैं इंतज़ार कर रही हूँ, पर इतना भी नहीं।"'),
  c('Bhai tu attempt nahi, record bana raha hai. Ab strategy badal, warna rank ka intezaar permanent ho jayega.', 'भाई तू attempt नहीं, रिकॉर्ड बना रहा है। अब स्ट्रैटेजी बदल, वरना रैंक का इंतज़ार परमानेंट हो जाएगा।'),
  c('Itne attempt me to log driving seekh ke licence bhi le lete hain!', 'इतने attempt में तो लोग ड्राइविंग सीखकर लाइसेंस भी ले लेते हैं!'),
  c('Tumse na ho payega! ...Par ek baar notes khol ke dikha, phir bolna.', 'तुमसे न हो पाएगा! ...पर एक बार नोट्स खोलकर दिखा, फिर बोलना।'),
  c('Ek hi galti baar baar? Bhai tu galti nahi, galti ka museum ban gaya hai.', 'एक ही गलती बार-बार? भाई तू गलती नहीं, गलती का म्यूज़ियम बन गया है।'),
  c('Govt job kehti hai: "Beta, pehle pass to ho jao, phir baat karte hain."', 'सरकारी नौकरी कहती है: "बेटा, पहले पास तो हो जाओ, फिर बात करते हैं।"'),
  c('Ye wahi score hai jo kal tha, aaj bhi hai. Bhai, ghadi bhi apna time badalti hai!', 'ये वही स्कोर है जो कल था, आज भी है। भाई, घड़ी भी अपना टाइम बदलती है!'),
  c('Kitna dard hai bhai! Teen attempt aur marks wahi. Ab explanation se dosti kar le.', 'कितना दर्द है भाई! तीन attempt और नंबर वही। अब एक्सप्लेनेशन से दोस्ती कर ले।'),
  c('Picture abhi baaki hai mere dost... bas is picture ka climax fail na ho, iska khayal rakh.', 'पिक्चर अभी बाकी है मेरे दोस्त... बस इस पिक्चर का क्लाइमैक्स फेल न हो, इसका ख़याल रख।'),
  c('Teen attempt ho gaye. Ab ya to topic jeet, ya topic tujhe jeet lega. Bol kya karna hai?', 'तीन attempt हो गए। अब या तो टॉपिक जीत, या टॉपिक तुझे जीत लेगा। बोल क्या करना है?'),
];

/** Passed, up to 69% ("a bit more effort") */
const PASS_UPTO_69: ResultComment[] = [
  c('Pass to ho gaya, par dhaage se latka hai. Thodi aur jaan laga!', 'पास तो हो गया, पर धागे से लटका है। थोड़ी और जान लगा!'),
  c('Theek hai, chal gaya. Par sarkari naukri ke liye "chal gaya" nahi, "chha gaya" chahiye.', 'ठीक है, चल गया। पर सरकारी नौकरी के लिए "चल गया" नहीं, "छा गया" चाहिए।'),
  c('Jugaad se pass hua kya? Sarkari naukri me jugaad nahi, mehnat chalti hai.', 'जुगाड़ से पास हुआ क्या? सरकारी नौकरी में जुगाड़ नहीं, मेहनत चलती है।'),
  c('Aur bhai, kaise ho? Sab theek? Marks ko bhi thoda theek kar le.', 'और भाई, कैसे हो? सब ठीक? नंबरों को भी थोड़ा ठीक कर ले।'),
  c('Itne marks pe mithai nahi, sirf chai banti hai. Mithai ke liye 80 la.', 'इतने नंबर पर मिठाई नहीं, सिर्फ़ चाय बनती है। मिठाई के लिए 80 ला।'),
  c('Jaan laga ke padho, kyunki abhi tak jaan lagayi nahi lagti.', 'जान लगाकर पढ़ो, क्योंकि अभी तक जान लगाई नहीं लगती।'),
  c('Thoda aur mehnat lagega bhai, abhi to sirf warm-up hua hai.', 'थोड़ी और मेहनत लगेगी भाई, अभी तो सिर्फ़ वार्म-अप हुआ है।'),
  c('Doosre log 80 maar rahe hain, tu "bas pass" pe khush? Bhai, thoda greedy ban.', 'दूसरे लोग 80 मार रहे हैं, तू "बस पास" पर खुश? भाई, थोड़ा लालची बन।'),
  c('Kinaare pe aa gaya hai, ab tairna seekh le.', 'किनारे पर आ गया है, अब तैरना सीख ले।'),
  c('Pass hai, par rank door hai. Pair chalte rakho.', 'पास है, पर रैंक दूर है। पैर चलते रखो।'),
];

/** Passed with 70–79% */
const PASS_70S: ResultComment[] = [
  c('70 aa gaye to ghar jaake so mat jaana, naukri bhi tere saath so jayegi.', '70 आ गए तो घर जाकर सो मत जाना, नौकरी भी तेरे साथ सो जाएगी।'),
  c('70 pe khush? Sarkari naukri 70 me nahi, 85 me milti hai. Chal utha kitab.', '70 पर खुश? सरकारी नौकरी 70 में नहीं, 85 में मिलती है। चल उठा किताब।'),
  c('Achha hai, par "achha" se naukri nahi milti, "zabardast" se milti hai.', 'अच्छा है, पर "अच्छा" से नौकरी नहीं मिलती, "ज़बरदस्त" से मिलती है।'),
  c('Bas bas, itna hi? Abhi 20-25 marks aur hain jo tera intezaar kar rahe hain.', 'बस बस, इतना ही? अभी 20-25 नंबर और हैं जो तेरा इंतज़ार कर रहे हैं।'),
  c('Picture abhi baaki hai mere dost! 70 aaya, 85 abhi baaki hai.', 'पिक्चर अभी बाकी है मेरे दोस्त! 70 आया, 85 अभी बाकी है।'),
  c('70 wale ko neend bahut aati hai. Alarm laga aur ek test aur de.', '70 वाले को नींद बहुत आती है। अलार्म लगा और एक टेस्ट और दे।'),
  c('Kya soch raha hai, 80 apne aap aa jayega? Wo bhi mehnat maangta hai bhai.', 'क्या सोच रहा है, 80 अपने आप आ जाएगा? वो भी मेहनत माँगता है भाई।'),
  c('Achha chal raha hai, par topper tujhe abhi bhi "bhai kaun?" bol raha hoga.', 'अच्छा चल रहा है, पर टॉपर तुझे अभी भी "भाई कौन?" बोल रहा होगा।'),
  c('Rishte me to 80 wale 70 wale ke baap lagte hain, naam hai Topper. Chal wahan tak pahunch.', 'रिश्ते में तो 80 वाले 70 वाले के बाप लगते हैं, नाम है टॉपर। चल वहाँ तक पहुँच।'),
  c('70 pe mat ruk. Rukne wale ko sarkari naukri bhi nahi rokti, seedha bhool jaati hai.', '70 पर मत रुक। रुकने वाले को सरकारी नौकरी भी नहीं रोकती, सीधा भूल जाती है।'),
];

/** Passed with 80–89% */
const PASS_80S: ResultComment[] = [
  c('Kya soch raha hai, 80 se ho jayega? Competition 90 par khel raha hai.', 'क्या सोच रहा है, 80 से हो जाएगा? कॉम्पिटिशन 90 पर खेल रहा है।'),
  c('Mast hai, par "mast" aur "selection" me 10 marks ka fark hai.', 'मस्त है, पर "मस्त" और "सेलेक्शन" में 10 नंबर का फ़र्क है।'),
  c('80 aaya, ab thoda gharoor bhi aaya hoga. Use abhi daba de, 90 ka time hai.', '80 आया, अब थोड़ा गुरूर भी आया होगा। उसे अभी दबा दे, 90 का टाइम है।'),
  c('Jahan hum khade ho jaate hain, line wahin se shuru hoti hai... bas selection list me naam aana baaki hai.', 'जहाँ हम खड़े हो जाते हैं, लाइन वहीं से शुरू होती है... बस सेलेक्शन लिस्ट में नाम आना बाकी है।'),
  c('Itna kar liya to thoda aur kar le, sarkari kursi tujhe bula rahi hai.', 'इतना कर लिया तो थोड़ा और कर ले, सरकारी कुर्सी तुझे बुला रही है।'),
  c('80 wale me 20 marks ki bhookh hoti hai. Padhai se bhookh mita.', '80 वाले में 20 नंबर की भूख होती है। पढ़ाई से भूख मिटा।'),
  c('Achha chal raha hai, par aaj "bas karo" bola to kal "kaash" bolna padega.', 'अच्छा चल रहा है, पर आज "बस करो" बोला तो कल "काश" बोलना पड़ेगा।'),
  c('Topper se bas thodi doori hai. Kitab ke saath thoda aur time bita.', 'टॉपर से बस थोड़ी दूरी है। किताब के साथ थोड़ा और टाइम बिता।'),
  c('Ye score ghar walon ko dikhane layak hai, par selection wale ko dikhane layak abhi nahi.', 'ये स्कोर घरवालों को दिखाने लायक है, पर सेलेक्शन वालों को दिखाने लायक अभी नहीं।'),
  c('Shabash! Ab is score ko "average" bana ke dikha.', 'शाबाश! अब इस स्कोर को "एवरेज" बनाकर दिखा।'),
];

/** Passed with 90% or more */
const PASS_90S: ResultComment[] = [
  c('Hmm theek hai, par abhi bhi dhaaga kholna baaki hai!', 'हम्म ठीक है, पर अभी भी धागा खोलना बाकी है!'),
  c('Mogambo khush hua! Par perfect score ke liye abhi thoda aur.', 'मोगैम्बो खुश हुआ! पर परफ़ेक्ट स्कोर के लिए अभी थोड़ा और।'),
  c('Ye score dekh ke baaki students ka dil toot raha hoga. Tu rukna mat.', 'ये स्कोर देखकर बाकी स्टूडेंट्स का दिल टूट रहा होगा। तू रुकना मत।'),
  c('Topper bhi tujhse "bhai kaise?" poochhne wala hai. Par ab perfect ke liye ek aur try.', 'टॉपर भी तुझसे "भाई कैसे?" पूछने वाला है। पर अब परफ़ेक्ट के लिए एक और कोशिश।'),
  c('Aag laga di! Ab dhyan rakhna, chhoti galti hi sabse badi dushman hai.', 'आग लगा दी! अब ध्यान रखना, छोटी गलती ही सबसे बड़ी दुश्मन है।'),
  c('Sarkari kursi ab tujhe door se salute kar rahi hai. Bas ek kadam aur.', 'सरकारी कुर्सी अब तुझे दूर से सैल्यूट कर रही है। बस एक कदम और।'),
  c('Ye to sach me "Chayan" wala score hai! Par ghamand nahi, roz padhna hai.', 'ये तो सच में "चयन" वाला स्कोर है! पर घमंड नहीं, रोज़ पढ़ना है।'),
  c('90+? Paper leak tha kya? Mazak, shabash! Ab yehi level har test me dikha.', '90+? पेपर लीक था क्या? मज़ाक, शाबाश! अब यही लेवल हर टेस्ट में दिखा।'),
  c('Is score ko pakadna mushkil hi nahi, namumkin hai! Ab yehi level har test me dikha.', 'इस स्कोर को पकड़ना मुश्किल ही नहीं, नामुमकिन है! अब यही लेवल हर टेस्ट में दिखा।'),
  c('Bhai tu asli champion hai. Par champion wahi, jo kal bhi isi level pe aaye.', 'भाई तू असली चैंपियन है। पर चैंपियन वही, जो कल भी इसी लेवल पर आए।'),
];

export type CommentBand = 'fail-1' | 'fail-2' | 'fail-3' | 'pass-69' | 'pass-70' | 'pass-80' | 'pass-90';

export const COMMENTS: Record<CommentBand, ResultComment[]> = {
  'fail-1': FAIL_FIRST,
  'fail-2': FAIL_SECOND,
  'fail-3': FAIL_THIRD,
  'pass-69': PASS_UPTO_69,
  'pass-70': PASS_70S,
  'pass-80': PASS_80S,
  'pass-90': PASS_90S,
};

/** Which group of comments applies to this result. */
export function commentBand(passed: boolean, percentage: number, attemptNumber: number): CommentBand {
  if (!passed) return attemptNumber <= 1 ? 'fail-1' : attemptNumber === 2 ? 'fail-2' : 'fail-3';
  const p = Math.round(percentage);
  return p >= 90 ? 'pass-90' : p >= 80 ? 'pass-80' : p >= 70 ? 'pass-70' : 'pass-69';
}
