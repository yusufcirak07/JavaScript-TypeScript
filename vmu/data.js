/**
 * TYPESCRIPT KAHOOT ARENA - SORU HAVUZU VE ÇÖZÜM VERİTABANI
 * Kullanıcının belirlediği 10 TypeScript Tip Güvenliği & Hata Ayıklama Sorusu
 */

const QUIZ_CONFIG = {
  title: "TypeScript Tip Avcısı: Canlı Quiz Arena",
  subtitle: "Gerçek Zamanlı Katılımcı Onaylı & Puan Sıralamalı Kod Yarışması",
  teacherPassword: "vm2627",
  basePoints: 1000,
  speedBonusMax: 500,
  defaultTimeSeconds: 90
};

const QUESTIONS = [
  {
    id: 1,
    number: 1,
    title: "Soru 1 — Yanlış dönüş tipi",
    difficulty: "Kolay",
    difficultyClass: "diff-easy",
    timeLimit: 90,
    prompt: "Aşağıdaki fonksiyondaki tip hatasını düzeltin.",
    buggyCode: `function countWords(text: string): number {
  return text.split(" ").length.toString();
}`,
    requirement: "Fonksiyon bir metindeki kelime sayısını number olarak döndürmelidir.",
    options: [
      {
        id: "A",
        code: `function countWords(text: string): number {\n  return text.split(" ").length;\n}`,
        note: ".toString() kaldırılarak doğrudan length (number) döndürülür"
      },
      {
        id: "B",
        code: `function countWords(text: string): string {\n  return text.split(" ").length.toString();\n}`,
        note: "Fonksiyonun dönüş tipi string olarak değiştirilir"
      },
      {
        id: "C",
        code: `function countWords(text: string): number {\n  return Number(text.split(" "));\n}`,
        note: "Bölünen dizi doğrudan Number() içine alınır"
      },
      {
        id: "D",
        code: `function countWords(text: string): number {\n  return text.split(" ").toString().length;\n}`,
        note: "Dizi metne çevrilip karakter uzunluğu döndürülür"
      }
    ],
    correctOption: "A",
    fixedCode: `function countWords(text: string): number {
  return text.split(" ").length;
}`,
    explanation: `text.split(" ").length zaten kelime sayısını number olarak verir. Sonuna .toString() eklemek değeri string tipine dönüştürdüğü için ": number" dönüş tipiyle çelişir. .toString() kaldırıldığında hata çözülür.`
  },
  {
    id: 2,
    number: 2,
    title: "Soru 2 — Geçersiz duygu türü",
    difficulty: "Kolay",
    difficultyClass: "diff-easy",
    timeLimit: 90,
    prompt: "Aşağıdaki fonksiyondaki dönüş tipi uyuşmazlığını düzeltin.",
    buggyCode: `type Sentiment = "positive" | "negative" | "neutral";

function detectSentiment(text: string): Sentiment {
  if (text.includes("kötü")) {
    return "negative";
  }

  return "happy";
}`,
    requirement: "Fonksiyonun tüm dönüş değerleri Sentiment tipiyle uyumlu olmalıdır.",
    options: [
      {
        id: "A",
        code: `return Sentiment.positive;`,
        note: "Sentiment birleşim tipine nesne gibi nokta ile erişilir"
      },
      {
        id: "B",
        code: `return "positive"; // veya "neutral"`,
        note: "Sentiment tipinde tanımlı geçerli bir literal değer döndürülür"
      },
      {
        id: "C",
        code: `return "happy" as any;`,
        note: "as any kullanılarak tip kontrolü devre dışı bırakılır"
      },
      {
        id: "D",
        code: `function detectSentiment(text: string): boolean {\n  return true;\n}`,
        note: "Dönüş tipi boolean olarak değiştirilir"
      }
    ],
    correctOption: "B",
    fixedCode: `type Sentiment = "positive" | "negative" | "neutral";

function detectSentiment(text: string): Sentiment {
  if (text.includes("kötü")) {
    return "negative";
  }

  return "positive";
}`,
    explanation: `Sentiment tipi yalnızca "positive", "negative" veya "neutral" değerlerini kabul eden bir String Literal Union tipidir. "happy" bu kümede yer almadığı için derleme hatası verir; "positive" veya "neutral" döndürülmelidir.`
  },
  {
    id: 3,
    number: 3,
    title: "Soru 3 — Yanlış nesne alanı tipi",
    difficulty: "Kolay",
    difficultyClass: "diff-easy",
    timeLimit: 90,
    prompt: "Aşağıdaki nesneyi arayüz (interface) tanımına uygun hâle getirin.",
    buggyCode: `interface AnalysisResult {
  summary: string;
  wordCount: number;
  successful: boolean;
}

const result: AnalysisResult = {
  summary: "Metin olumlu.",
  wordCount: "15",
  successful: "yes"
};`,
    requirement: "Nesneyi AnalysisResult arayüzüne uygun hâle getirin.",
    options: [
      {
        id: "A",
        code: `const result: AnalysisResult = {\n  summary: "Metin olumlu.",\n  wordCount: 15,\n  successful: "true"\n};`,
        note: "wordCount sayı yapılır, successful tırnak içinde 'true' yazılır"
      },
      {
        id: "B",
        code: `const result: AnalysisResult = {\n  summary: 15,\n  wordCount: 15,\n  successful: true\n};`,
        note: "Tüm alanlara sayısal ve boolean değerler verilir"
      },
      {
        id: "C",
        code: `const result: AnalysisResult = {\n  summary: "Metin olumlu.",\n  wordCount: 15,\n  successful: true\n};`,
        note: "wordCount: 15 (number) ve successful: true (boolean) olarak atanır"
      },
      {
        id: "D",
        code: `const result: AnalysisResult = {\n  summary: "Metin olumlu.",\n  wordCount: "15" as number,\n  successful: "yes" as boolean\n};`,
        note: "String değerler as operatörü ile zorlanır"
      }
    ],
    correctOption: "C",
    fixedCode: `interface AnalysisResult {
  summary: string;
  wordCount: number;
  successful: boolean;
}

const result: AnalysisResult = {
  summary: "Metin olumlu.",
  wordCount: 15,
  successful: true
};`,
    explanation: `AnalysisResult arayüzünde wordCount alanı number, successful alanı ise boolean olarak tanımlanmıştır. "15" (string) yerine 15 (number) ve "yes" (string) yerine true (boolean) kullanılmalıdır.`
  },
  {
    id: 4,
    number: 4,
    title: "Soru 4 — Yanlış dizi tipi",
    difficulty: "Kolay",
    difficultyClass: "diff-easy",
    timeLimit: 90,
    prompt: "Aşağıdaki fonksiyonun dönüş değerindeki tip uyuşmazlığını giderin.",
    buggyCode: `function extractKeywords(text: string): string[] {
  const words: string[] = text.split(" ");

  return words.length;
}`,
    requirement: "Fonksiyon bir kelime dizisi döndürmelidir. Hem değişkenin hem de dönüş değerinin tiplerini kontrol edin.",
    options: [
      {
        id: "A",
        code: `function extractKeywords(text: string): string[] {\n  const words: string[] = text.split(" ");\n  return words;\n}`,
        note: "words.length (number) yerine doğrudan words (string[]) dizisi döndürülür"
      },
      {
        id: "B",
        code: `function extractKeywords(text: string): number {\n  const words: string[] = text.split(" ");\n  return words.length;\n}`,
        note: "Fonksiyonun dönüş tipi number olarak değiştirilir"
      },
      {
        id: "C",
        code: `function extractKeywords(text: string): string[] {\n  const words: number[] = text.split(" ");\n  return words;\n}`,
        note: "words değişkeninin tipi number[] yapılır"
      },
      {
        id: "D",
        code: `function extractKeywords(text: string): string[] {\n  const words: string = text.split(" ");\n  return [words];\n}`,
        note: "words tipi string yapılır ve dizi içine alınır"
      }
    ],
    correctOption: "A",
    fixedCode: `function extractKeywords(text: string): string[] {
  const words: string[] = text.split(" ");

  return words;
}`,
    explanation: `Fonksiyonun dönüş tipi string[] (kelime dizisi) olarak bildirilmiştir ve words değişkeni zaten string[] tipindedir. words.length bir sayı (number) ürettiği için hata verir; doğrudan "return words;" yazılmalıdır.`
  },
  {
    id: 5,
    number: 5,
    title: "Soru 5 — Olmayan özellik erişimi",
    difficulty: "Kolay–orta",
    difficultyClass: "diff-easy-med",
    timeLimit: 90,
    prompt: "Aşağıdaki fonksiyonda arayüzde bulunmayan özellik erişimini düzeltin.",
    buggyCode: `interface AIResponse {
  answer: string;
  confidence: number;
}

function displayResponse(response: AIResponse): void {
  console.log(response.message);
  console.log(response.confidence);
}`,
    requirement: "Kodun tanımlı olmayan bir özelliğe erişmesini engelleyin.",
    options: [
      {
        id: "A",
        code: `console.log(response["message"]);\nconsole.log(response.confidence);`,
        note: "Köşeli parantez notasyonu ile message özelliğine erişilir"
      },
      {
        id: "B",
        code: `console.log(response.answer.message);\nconsole.log(response.confidence);`,
        note: "response.answer üzerinden .message çağrılır"
      },
      {
        id: "C",
        code: `console.log(response.answer);\nconsole.log(response.confidence);`,
        note: "AIResponse arayüzünde tanımlı olan response.answer özelliği kullanılır"
      },
      {
        id: "D",
        code: `console.log(response.toString());\nconsole.log(response.message);`,
        note: "Önce toString() çağrılıp ardından message yazdırılır"
      }
    ],
    correctOption: "C",
    fixedCode: `interface AIResponse {
  answer: string;
  confidence: number;
}

function displayResponse(response: AIResponse): void {
  console.log(response.answer);
  console.log(response.confidence);
}`,
    explanation: `AIResponse arayüzünde "message" adında bir alan yoktur; metin yanıtı "answer: string" alanında tutulmaktadır. Bu nedenle response.message yerine response.answer kullanılmalıdır.`
  },
  {
    id: 6,
    number: 6,
    title: "Soru 6 — Null kontrolü",
    difficulty: "Orta",
    difficultyClass: "diff-medium",
    timeLimit: 90,
    prompt: "Olası null değerine karşı güvenli tip daraltma (narrowing) uygulayın.",
    buggyCode: `function createSummary(text: string | null): string {
  return text.substring(0, 30);
}`,
    requirement: "text değeri null olduğunda hata oluşmamasını sağlayın. Fonksiyon her durumda bir string döndürmelidir.",
    options: [
      {
        id: "A",
        code: `function createSummary(text: string | null): string {\n  return text?.substring(0, 30);\n}`,
        note: "Sadece optional chaining (?.) kullanılır (varsayılan değer verilmez)"
      },
      {
        id: "B",
        code: `function createSummary(text: string | null): string {\n  if (!text) return "";\n  return text.substring(0, 30);\n}`,
        note: "Null kontrolü (veya text ?? '') ile her durumda string döndürülür"
      },
      {
        id: "C",
        code: `function createSummary(text: string | null): string {\n  return text!.substring(0, 30);\n}`,
        note: "Non-null assertion (!) ile derleyici susturulur"
      },
      {
        id: "D",
        code: `function createSummary(text: string | null): string {\n  if (text === null) return null;\n  return text.substring(0, 30);\n}`,
        note: "text null olduğunda null döndürülür"
      }
    ],
    correctOption: "B",
    fixedCode: `function createSummary(text: string | null): string {
  if (!text) {
    return "";
  }
  return text.substring(0, 30);
}`,
    explanation: `text parametresi "string | null" olduğu için doğrudan text.substring() çağırmak null durumunda çalışma zamanı hatası üretir. "if (!text) return '';" (veya "return (text ?? '').substring(0, 30);") ile hem null hatası önlenir hem de her durumda string döndürülür.`
  },
  {
    id: 7,
    number: 7,
    title: "Soru 7 — Yanlış fonksiyon parametresi",
    difficulty: "Orta",
    difficultyClass: "diff-medium",
    timeLimit: 90,
    prompt: "Fonksiyon çağrısını tanımlanan Message arayüzüne uygun şekilde düzeltin.",
    buggyCode: `interface Message {
  content: string;
  sender: string;
}

function sendMessage(message: Message): void {
  console.log(message.content);
}

sendMessage("Merhaba AI!");`,
    requirement: "Fonksiyon çağrısını veya fonksiyon tasarımını, tanımlanan veri yapısına uygun olacak şekilde düzeltin.",
    options: [
      {
        id: "A",
        code: `sendMessage({\n  content: "Merhaba AI!",\n  sender: "user"\n});`,
        note: "Message arayüzüne uygun { content, sender } nesnesi gönderilir"
      },
      {
        id: "B",
        code: `sendMessage({ content: "Merhaba AI!" });`,
        note: "Sadece content alanını içeren bir nesne gönderilir"
      },
      {
        id: "C",
        code: `sendMessage("Merhaba AI!", "user");`,
        note: "İki ayrı string argüman olarak gönderilir"
      },
      {
        id: "D",
        code: `function sendMessage(message: string): void {\n  console.log(message.content);\n}`,
        note: "Parametre tipi string yapılır ama message.content korunur"
      }
    ],
    correctOption: "A",
    fixedCode: `interface Message {
  content: string;
  sender: string;
}

function sendMessage(message: Message): void {
  console.log(message.content);
}

sendMessage({
  content: "Merhaba AI!",
  sender: "user"
});`,
    explanation: `sendMessage fonksiyonu Message tipinde ({ content: string, sender: string }) bir nesne beklemektedir. Doğrudan düz string ("Merhaba AI!") göndermek yerine her iki zorunlu alanı içeren bir nesne ile çağrılmalıdır.`
  },
  {
    id: 8,
    number: 8,
    title: "Soru 8 — Eksik nesne alanı",
    difficulty: "Orta",
    difficultyClass: "diff-medium",
    timeLimit: 90,
    prompt: "ChatMessage arayüzüne göre nesnedeki eksik alanı uygun tiple tamamlayın.",
    buggyCode: `interface ChatMessage {
  id: number;
  content: string;
  sender: string;
  timestamp: number;
}

const message: ChatMessage = {
  id: 1,
  content: "Bana yardımcı ol.",
  sender: "user"
};`,
    requirement: "Nesneyi ChatMessage arayüzüne uygun hâle getirin. Eksik alan için uygun bir değer sağlayın.",
    options: [
      {
        id: "A",
        code: `const message: ChatMessage = {\n  id: 1,\n  content: "Bana yardımcı ol.",\n  sender: "user",\n  timestamp: "2026-10-21"\n};`,
        note: "timestamp alanı string tarih olarak eklenir"
      },
      {
        id: "B",
        code: `const message: ChatMessage = {\n  id: 1,\n  content: "Bana yardımcı ol.",\n  sender: "user",\n  timestamp: new Date()\n};`,
        note: "timestamp alanı Date nesnesi olarak eklenir"
      },
      {
        id: "C",
        code: `const message: ChatMessage = {\n  id: 1,\n  content: "Bana yardımcı ol.",\n  sender: "user",\n  timestamp: Date.now()\n};`,
        note: "Eksik olan timestamp alanı sayısal (number) değerle eklenir"
      },
      {
        id: "D",
        code: `const message: ChatMessage = {\n  id: 1,\n  content: "Bana yardımcı ol.",\n  sender: "user",\n  time: 1729520000\n};`,
        note: "time adında sayısal bir alan eklenir"
      }
    ],
    correctOption: "C",
    fixedCode: `interface ChatMessage {
  id: number;
  content: string;
  sender: string;
  timestamp: number;
}

const message: ChatMessage = {
  id: 1,
  content: "Bana yardımcı ol.",
  sender: "user",
  timestamp: Date.now()
};`,
    explanation: `ChatMessage arayüzünde "timestamp: number" zorunlu bir alandır. Date.now() (veya sayısal bir Unix zaman damgası) number döndürdüğü için arayüz sözleşmesini eksiksiz karşılar.`
  },
  {
    id: 9,
    number: 9,
    title: "Soru 9 — Promise dönüş tipi",
    difficulty: "Orta–zor",
    difficultyClass: "diff-med-hard",
    timeLimit: 90,
    prompt: "Asenkron fonksiyonun Promise dönüş tipini sözleşmeye uygun hâle getirin.",
    buggyCode: `async function getAIResponse(prompt: string): Promise<string> {
  const response = await Promise.resolve({
    answer: "Merhaba!",
    confidence: 0.98
  });

  return response;
}`,
    requirement: "Fonksiyonun Promise<string> sözleşmesine uymasını sağlayın. İsterseniz dönüş tipini değiştirerek nesnenin tamamını döndürecek şekilde de tasarlayabilirsiniz.",
    options: [
      {
        id: "A",
        code: `return Promise.resolve(response);`,
        note: "response nesnesi tekrar Promise.resolve içine alınır"
      },
      {
        id: "B",
        code: `return response.answer;\n// veya dönüş tipini Promise<{ answer: string; confidence: number }> yapmak`,
        note: "string olan response.answer döndürülür (veya dönüş tipi nesneye uyarlanır)"
      },
      {
        id: "C",
        code: `return response.confidence;`,
        note: "number tipindeki confidence alanı döndürülür"
      },
      {
        id: "D",
        code: `function getAIResponse(prompt: string): string {\n  const response = await Promise.resolve({ answer: "Merhaba!", confidence: 0.98 });\n  return response.answer;\n}`,
        note: "async anahtar kelimesi kaldırılarak içeride await kullanılır"
      }
    ],
    correctOption: "B",
    fixedCode: `async function getAIResponse(prompt: string): Promise<string> {
  const response = await Promise.resolve({
    answer: "Merhaba!",
    confidence: 0.98
  });

  return response.answer;
}`,
    explanation: `Fonksiyon Promise<string> döndürmeyi taahhüt etmektedir ancak response değişkeni "{ answer: string, confidence: number }" tipinde bir nesnedir. Doğrudan string olan "response.answer" döndürülmeli ya da fonksiyonun dönüş tipi nesne tipine güncellenmelidir.`
  },
  {
    id: 10,
    number: 10,
    title: "Soru 10 — Birden fazla tip hatası",
    difficulty: "Final",
    difficultyClass: "diff-final",
    timeLimit: 90,
    prompt: "Aşağıdaki kodda birden fazla tip hatası bulunmaktadır. Tümünü düzeltin.",
    buggyCode: `type Sentiment = "positive" | "negative" | "neutral";

interface AnalysisResult {
  sentiment: Sentiment;
  wordCount: number;
  summary: string;
}

function analyzeText(text: string): AnalysisResult {
  const words: number[] = text.split(" ");

  return {
    sentiment: "happy",
    wordCount: words,
    summary: null
  };
}`,
    requirement: "Değişken tipini ve döndürülen nesnenin tüm alanlarını AnalysisResult ve Sentiment tipleriyle tam uyumlu hâle getirin.",
    options: [
      {
        id: "A",
        code: `const words: string[] = text.split(" ");\nreturn {\n  sentiment: "happy",\n  wordCount: words.length,\n  summary: "Özet"\n};`,
        note: "words ve wordCount düzeltilir ancak sentiment 'happy' bırakılır"
      },
      {
        id: "B",
        code: `const words: string[] = text.split(" ");\nreturn {\n  sentiment: "positive",\n  wordCount: words,\n  summary: "Özet"\n};`,
        note: "sentiment ve summary düzeltilir ancak wordCount'a dizi atanır"
      },
      {
        id: "C",
        code: `const words: number[] = text.split(" ");\nreturn {\n  sentiment: "neutral",\n  wordCount: words.length,\n  summary: "Özet"\n};`,
        note: "Dönüş nesnesi düzeltilir ancak words: number[] bırakılır"
      },
      {
        id: "D",
        code: `const words: string[] = text.split(" ");\nreturn {\n  sentiment: "positive",\n  wordCount: words.length,\n  summary: "Metin analizi tamamlandı."\n};`,
        note: "4 hatanın tamamı (string[], Sentiment, words.length ve string summary) düzeltilir"
      }
    ],
    correctOption: "D",
    fixedCode: `type Sentiment = "positive" | "negative" | "neutral";

interface AnalysisResult {
  sentiment: Sentiment;
  wordCount: number;
  summary: string;
}

function analyzeText(text: string): AnalysisResult {
  const words: string[] = text.split(" ");

  return {
    sentiment: "positive",
    wordCount: words.length,
    summary: "Metin analizi tamamlandı."
  };
}`,
    explanation: `Kodda 4 ayrı tip hatası vardır: 1) text.split(" ") bir string[] döndürür (number[] olamaz). 2) "happy" geçerli bir Sentiment değildir ("positive" | "negative" | "neutral" olmalıdır). 3) wordCount bir number bekler, dizi (words) yerine words.length verilmelidir. 4) summary alanı string beklediği için null yerine metin atanmalıdır.`
  }
];
