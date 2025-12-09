
import { GoogleGenAI } from "@google/genai";
import { MOCK_TRANSLATION } from "../constants";

const MODEL_NAME = 'gemini-2.5-flash';

// Helper to get client
const getClient = (apiKey: string) => {
  if (!apiKey) throw new Error("API Key missing");
  return new GoogleGenAI({ apiKey });
};

export const translateParagraph = async (segments: string[], apiKey: string): Promise<string[]> => {
  // Free Tier Simulation
  if (!apiKey) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Return mock translations corresponding to the number of segments requested
    // Logic: Cycle through mock translations if more segments are requested than available
    return segments.map((_, i) => MOCK_TRANSLATION[i % MOCK_TRANSLATION.length]);
  }

  try {
    const ai = getClient(apiKey);
    const prompt = `
      Task: Translate the following Chassidic Hebrew segments into English. 
      The segments form a continuous paragraph.
      
      Strict Formatting Rules:
      1. **Output**: Return ONLY a JSON Array of strings. e.g. ["Translation 1", "Translation 2"].
      2. **Bolding**: Use HTML <b> tags ONLY for direct quotes from Psukim (Scripture) or standard Rabbinic phrases.
      3. **Commentary**: Interjected commentary must be in <span class="opacity-60 italic"> tags.
      4. **Consistency**: Maintain the flow between segments.

      Input Segments:
      ${JSON.stringify(segments)}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || "[]";
    let translations: string[] = [];
    try {
        translations = JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse translation JSON", text);
        translations = [text];
    }
    
    // Cleanup formatting
    return translations.map(t => t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'));

  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

export const chatWithAI = async (query: string, context: string, apiKey: string, history: {role: 'user' | 'model', content: string}[] = []): Promise<{ text: string, followUps: string[] }> => {
  const lowerQuery = query.toLowerCase();

  // Special Handling for "How do I get an API Key" logic
  if (lowerQuery.includes("how do i get") && (lowerQuery.includes("api key") || lowerQuery.includes("key"))) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
          text: `<b>How to get a Free Google Gemini API Key:</b><br><br>
          1. Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" class="underline font-bold">Google AI Studio</a>.<br>
          2. Click <b>"Create API Key"</b>.<br>
          3. Select a Google Cloud project (or create a new one).<br>
          4. Copy the key and paste it into your Profile on Chassidus.ai.<br><br>
          <b>Privacy Note:</b> Your key is stored locally on your device. Chassidus.ai is open-source and never shares your data or your key with anyone. Using your own key ensures unlimited, private access.`,
          followUps: ["Is it free?", "Is my data secure?"]
      };
  }
  
  // Free Tier Simulation / No Key
  if (!apiKey) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for "Privacy" question
    if (lowerQuery.includes("private") || lowerQuery.includes("secure") || lowerQuery.includes("data")) {
        return {
            text: `<b>Free, Secure, and Private.</b><br><br>
            When you use Chassidus.ai with your own API key, you communicate directly with Google's servers. No data is shared with Chassidus.ai creators, and we do not track your conversations.<br><br>
            Your API key is saved in a cookie on your browser and is never transmitted to our backend (because we don't have one!).`,
            followUps: ["How do I get an API Key?"]
        };
    }

    // High Quality "Mock" Responses
    if (lowerQuery.includes('summary') || lowerQuery.includes('summarize')) {
        return {
            text: "This section explores the fundamental relationship between <b>Torah</b> and <b>Creation</b>.<br><br>The text explains that the world was created through the \"Wisdom of Torah\". Specifically, it cites the Zohar: <i>\"Istakel B'Oraita U'bara Alma\"</i> (He looked into the Torah and created the world).<br><br>This means Torah is not just a history book or a legal code given <i>after</i> creation, but the very blueprint <i>for</i> creation. The Divine wisdom contained within Torah (specifically the \"Ten Utterances\" found in Genesis) serves as the DNA for all existence.<br><br><span class='opacity-50 text-xs uppercase tracking-widest'>[Free Trial Mode] • Add your key for unlimited access.</span>",
            followUps: ["How do I get an API Key?", "Explain 'Istakel B'Oraita'", "What are the Ten Utterances?"]
        };
    } else if (lowerQuery.includes('oros') || lowerQuery.includes('keilim') || lowerQuery.includes('lights')) {
         return {
            text: "The relationship between <b>Oros</b> (Lights) and <b>Keilim</b> (Vessels) is the central dynamic of existence.<br><br><b>Lights (Oros)</b> refer to raw, infinite Divine energy/expression. It is the \"content\" or \"inspiration\".<br><b>Vessels (Keilim)</b> refer to the definitions, limitations, and structures that contain that energy. It is the \"context\" or \"words\".<br><br>The text mentions that in the World of <b>Tohu</b>, the Lights were too intense for the Vessels, causing a shattering. In our world of <b>Tikun</b>, we work to build broad, strong vessels (through Torah and Mitzvos) that can safely contain the infinite Light without breaking.<br><br><span class='opacity-50 text-xs uppercase tracking-widest'>[Free Trial Mode] • Add your key for unlimited access.</span>",
            followUps: ["How do I get an API Key?", "What is Tohu?", "How does this apply to me?"]
        };
    } else {
        return {
            text: "The Chassidic Scholar is analyzing your request.<br><br>The text delves into the concept of <i>Chochmah Ila'ah</i> (Supernal Wisdom) and its descent into creation. It distinguishes between the wisdom found in the Torah itself versus the wisdom used to engineer the physical world.<br><br><b>To continue the conversation and ask specific questions, please add your free API Key.</b><br><br><span class='opacity-50 text-xs uppercase tracking-widest'>[Free Trial Mode]</span>",
            followUps: ["How do I get an API Key?", "Is my data secure?", "Summarize the text"]
        };
    }
  }

  // Real API Call
  try {
    const ai = getClient(apiKey);
    
    const historyContext = history.map(msg => `${msg.role === 'user' ? 'User' : 'Scholar'}: ${msg.content}`).join('\n');

    const prompt = `
      Role: Expert Chassidic Scholar.
      
      Previous Conversation:
      ${historyContext}

      Current Context (Text is divided into [Section X]):
      "${context}"

      User Question: "${query}"

      Instructions:
      1. Answer clearly and deeply.
      2. **Citations**: When you reference the text, you MUST cite the source using the format **[Section X]**. This is critical for the user to verify sources.
      3. **Formatting**:
         - Use <b>text</b> for bold (concepts, terms).
         - Use <i>text</i> for italics.
         - Use <b><i>text</i></b> for titles or heavy emphasis.
         - Use <br><br> for paragraph breaks.
      4. **Structure**: Split response into short, digestible paragraphs.
      5. Suggest 3 follow-up questions in JSON format: <<<FOLLOWUPS>>>["Q1", "Q2", "Q3"]<<<END>>>
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const rawText = response.text || "";
    
    let cleanText = rawText;
    let followUps: string[] = [];
    
    const match = rawText.match(/<<<FOLLOWUPS>>>([\s\S]*?)<<<END>>>/);
    if (match && match[1]) {
      try {
        followUps = JSON.parse(match[1]);
        cleanText = rawText.replace(match[0], '').trim();
      } catch (e) {
        console.error("Failed to parse followups", e);
      }
    }
    
    // Convert markdown to HTML (preserve [Section X] for frontend parsing)
    cleanText = cleanText
      .replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    // Remove leading/trailing breaks and excessive breaks
    cleanText = cleanText
        .replace(/^(<br>)+|(<br>)+$/g, '')
        .replace(/(<br>\s*){3,}/g, '<br><br>');

    return { text: cleanText, followUps };
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};
