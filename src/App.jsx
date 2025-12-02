import React, { useState } from 'react';

// --- Global Configuration (Mandatory Setup) ---
// Note: API Key is set to "" and will be injected by the environment if deployed to a platform like Canvas.
const apiKey = "AIzaSyCG5jFwxIMO9_BVl6odE3uoiI4W0iJiH28"; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// The JSON schema ensures the Ad Copy model returns a predictable array of copy objects.
const adCopyResponseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      "style": { "type": "STRING", "description": "e.g., 'Short & Punchy', 'Emotional Story', 'Detailed Feature Set'" },
      "headline": { "type": "STRING", "description": "A compelling headline for the ad." },
      "bodyCopy": { "type": "STRING", "description": "The main ad copy, concise and persuasive." },
      "callToAction": { "type": "STRING", "description": "A strong, relevant call to action." }
    },
    required: ["style", "headline", "bodyCopy", "callToAction"]
  }
};

// --- Content Generation Types ---
const CONTENT_TYPES = [
    { label: 'LinkedIn Post (Short)', value: 'LinkedIn Post (Executive Summary/Short Form)', tone: 'Professional, Punchy, Focused on ROI' },
    { label: 'Blog Post Outline', value: 'Detailed Blog Post Outline (5 main sections)', tone: 'Informative, Thought Leadership' },
    { label: 'Newsletter Article (Medium)', value: 'Newsletter Article (300-500 words)', tone: 'Actionable, Direct, B2B' },
    { label: 'Email Subject Line & Body Draft', value: 'High-Converting Email Draft and 5 Subject Line Options', tone: 'Persuasive, Urgent' },
    { label: 'Whitepaper/eBook Section Draft', value: 'Detailed Draft of a Whitepaper Section (500-750 words)', tone: 'Deeply Technical, Authoritative' },
];


// --- Helper Functions ---
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      // NOTE: Using the global apiUrl here, as the key is handled globally in this single-model setup.
      const response = await fetch(url, options);
      if (response.ok) {
        return await response.json();
      } else {
        const errorBody = await response.json();
        if (response.status === 429 && i < retries - 1) {
          const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
          console.warn(`Rate limit hit. Retrying in ${Math.round(delay / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`API Request Failed: ${response.status} ${response.statusText}. Details: ${JSON.stringify(errorBody)}`);
      }
    } catch (e) {
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`Network error. Retrying in ${Math.round(delay / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw e;
    }
  }
};

// Global counter for generating unique keys in renderMarkdown
let uniqueKeyCounter = 0;

// Function to convert Markdown text to React elements (Custom simplified renderer)
const renderMarkdown = (markdownText) => {
    if (!markdownText) return null;

    const lines = markdownText.split('\n');
    const elements = [];
    let currentInsightBlock = [];
    let currentInsightTitle = ''; 

    const finalizeInsightBlock = () => {
        // In the new structure, this function is only used for introductory text/paragraphs
        if (currentInsightBlock.length > 0) {
            elements.push(<div key={`insight-block-${uniqueKeyCounter++}`} className="space-y-3 text-sm text-gray-700">{currentInsightBlock}</div>);
            currentInsightBlock = [];
        }
    };

    lines.forEach((line) => {
        const trimmedLine = line.trim();
        
        // 1. Markdown Headers (e.g., ### Key Strategic Insights)
        if (trimmedLine.startsWith('#')) {
            finalizeInsightBlock();
            const match = trimmedLine.match(/^(#+)\s*(.*)/);
            const level = match ? Math.min(match[1].length, 4) : 4; 
            const content = match ? match[2] : trimmedLine;
            
            const htmlContent = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');

            const HeaderTag = `h${level}`;
            elements.push(React.createElement(HeaderTag, { 
                key: `header-${uniqueKeyCounter++}`, 
                className: `font-bold mt-6 mb-2 ${level <= 2 ? 'text-xl' : 'text-lg'}`,
                dangerouslySetInnerHTML: { __html: htmlContent } 
            }));
        } 
        // 2. Structural Content (Inside the Insight Cards)
        else {
            // Check for labeled content (Action/Recommendation)
            let content = trimmedLine;
            
            // --- HIERARCHICAL LABEL REPLACEMENTS ---
            content = content.replace(/^(Action \/ Insight:)/, '<span class="font-bold text-gray-800">Action / Insight:</span>');
            content = content.replace(/^(Recommendation \/ Marketing Strategy:)/, '<span class="font-bold text-gray-800">Recommendation / Marketing Strategy:</span>');
            content = content.replace(/^(Action:)/, '<span class="font-bold text-gray-800">Action:</span>');
            content = content.replace(/^(Recommendation:)/, '<span class="font-bold text-gray-800">Recommendation:</span>');
            content = content.replace(/^(Insight:)/, '<span class="font-bold text-gray-800">Insight:</span>');
            content = content.replace(/^(Marketing Strategy:)/, '<span class="font-bold text-gray-800">Marketing Strategy:</span>');
            
            // Standard inline formatting
            content = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');
            
            if (trimmedLine.length > 0) {
                currentInsightBlock.push(<p key={`body-${uniqueKeyCounter++}`} className="mt-1" dangerouslySetInnerHTML={{ __html: content }} />);
            } else {
                // Handle empty line separator within text blocks
                currentInsightBlock.push(<div key={`spacer-${uniqueKeyCounter++}`} className="h-1"></div>);
            }
        }
    });

    finalizeInsightBlock();
    return <div className="space-y-3">{elements}</div>;
};


// ----------------------------------------------------------------------
// --- MODULE 1: Ad Copy Generator Component ----------------------------
// ----------------------------------------------------------------------

const AdCopyGenerator = () => {
  const defaultProductName = 'CargoWise';
  const defaultKeyBenefit = 'Enhanced operational efficiency through automation and real-time visibility across the supply chain, leading to better decision-making and simplified global compliance';
  const defaultTargetAudience = 'Logistics and Freight Forwarding Companies';
  const defaultTone = 'Professional, trustworthy, and innovative';
  const defaultNumVariants = 3; 

  const [productName, setProductName] = useState(defaultProductName);
  const [keyBenefit, setKeyBenefit] = useState(defaultKeyBenefit);
  const [targetAudience, setTargetAudience] = useState(defaultTargetAudience);
  const [tone, setTone] = useState(defaultTone);
  const [numVariants, setNumVariants] = useState(defaultNumVariants); 
  
  const [loading, setLoading] = useState(false);
  const [adCopies, setAdCopies] = useState([]);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState(''); 
  
  // NEW STATE: For file upload reference
  const [fileBase64, setFileBase64] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        // e.target.result is the data URL (e.g., data:application/pdf;base64,...)
        const dataUrl = e.target.result;
        
        // Split the data URL to get the MIME type and the Base64 data
        const [meta, base64Data] = dataUrl.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];

        // Store the relevant data
        setFileBase64({
            data: base64Data,
            mimeType: mimeType
        });
        setFileName(file.name);
      };
      
      reader.onerror = () => {
        setError("Failed to read file.");
        setFileBase64(null);
        setFileName('');
      };

      // Read the file as a Data URL (Base64)
      reader.readAsDataURL(file);
    } else {
        setFileBase64(null);
        setFileName('');
    }
  };

  const generateCopy = async () => {
    setLoading(true);
    setAdCopies([]);
    setError('');
    
    // 1. Prepare text parts
    let promptParts = [
      { text: `Generate exactly ${numVariants} distinct ad copy variants for the following product, target, and tone. Reference any provided file content to ensure the copy is highly specific and on-brand for CargoWise.` },
      { text: `
      - Product Name: ${productName}
      - Key Benefit: ${keyBenefit}
      - Target Audience: ${targetAudience}
      - Tone: ${tone}
      `},
    ];

    // 2. Prepare file part (if fileBase64 exists)
    if (fileBase64) {
        promptParts = [
            { text: `CONTEXT FILE: Analyze the attached file (e.g., press release, spec sheet, competitor analysis). Use the key themes, terminology, and metrics from this document as the foundation for the ad copy generation.`},
            { inlineData: fileBase64 },
            ...promptParts, // Append the text prompt after the file instruction
        ];
    }
    
    const systemPrompt = "You are a world-class advertising copywriter specializing in highly effective A/B tested ad concepts. Your task is to analyse the product details and generate exactly the requested number of distinct ad copy variants in the provided JSON format. **Crucially, all responses must be in Australian English.**";

    const payload = {
      contents: [{ parts: promptParts }], // Send the combined parts array
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: adCopyResponseSchema,
      }
    };

    try {
      const response = await fetchWithRetry(apiUrl, { // Uses global apiUrl
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) {
        throw new Error("Failed to receive structured content from the model.");
      }
      
      const parsedCopies = JSON.parse(jsonText);
      setAdCopies(parsedCopies);

    } catch (err) {
      console.error('Generation Error:', err);
      setError(`Failed to generate copy: ${err.message}. Please check your inputs and network connection.`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProductName(defaultProductName);
    setKeyBenefit(defaultKeyBenefit);
    setTargetAudience(defaultTargetAudience);
    setTone(defaultTone);
    setNumVariants(defaultNumVariants); 
    setAdCopies([]);
    setError('');
    setLoading(false); 
    setFileBase64(null); // Reset file
    setFileName('');     // Reset filename
  };
  
  const copyToClipboard = (copy) => {
    const textToCopy = `Headline: ${copy.headline}\nBody: ${copy.bodyCopy}\nCTA: ${copy.callToAction}`;
    
    // Create a temporary textarea element for execCommand fallback
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopyStatus('Copied to Clipboard!');
        setTimeout(() => setCopyStatus(''), 3000);
      } else {
        setCopyStatus('Copy failed.');
        setTimeout(() => setCopyStatus(''), 3000);
      }
    } catch (err) {
      setCopyStatus('Copy failed: See console for details.');
      setTimeout(() => setCopyStatus(''), 3000);
      console.error('Could copy text using execCommand: ', err);
    }
    
    document.body.removeChild(textArea);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto relative">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Ad Copy Generator</h2>
        <p className="text-lg text-custom-blue mb-8">
            Create multiple distinct ad copy variants using the Gemini API.
        </p>

        {/* --- Input Panel --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="productName" className="block text-sm font-medium text-gray-700">Product/Service Name</label>
              <input
                id="productName"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-custom-blue focus:ring-custom-blue p-3 border"
                placeholder="e.g., CargoWise"
              />
            </div>
            <div>
              <label htmlFor="keyBenefit" className="block text-sm font-medium text-gray-700">Core Benefit/Value Proposition</label>
              <input
                id="keyBenefit"
                type="text"
                value={keyBenefit}
                onChange={(e) => setKeyBenefit(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-custom-blue focus:ring-custom-blue p-3 border"
                placeholder="e.g., Enhanced operational efficiency..."
              />
            </div>
            
            <div>
              <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700">Target Audience</label>
              <input
                id="targetAudience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-custom-blue focus:ring-custom-blue p-3 border"
                placeholder="e.g., Logistics and Freight Forwarding Companies"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="numVariants" className="block text-sm font-medium text-gray-700"># Variants</label>
                    <input
                        id="numVariants"
                        type="number"
                        min="1"
                        max="5"
                        value={numVariants}
                        onChange={(e) => setNumVariants(Math.max(1, Math.min(5, Number(e.target.value))))} 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-custom-blue focus:ring-custom-blue p-3 border"
                        placeholder="3"
                    />
                </div>
                <div>
                    <label htmlFor="tone" className="block text-sm font-medium text-gray-700">Desired Tone</label>
                    <input
                        id="tone"
                        type="text"
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-custom-blue focus:ring-custom-blue p-3 border"
                        placeholder="e.g., Professional, trustworthy, and innovative"
                    />
                </div>
            </div>
          </div>

          {/* --- File Upload (Reference Material) --- */}
          <div className="mt-6 border-t pt-6">
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                Reference Material (Optional)
            </label>
            <input
                id="file-upload"
                type="file"
                accept=".pdf,.txt,.docx"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-custom-blue/10 file:text-custom-blue
                    hover:file:bg-custom-blue/20 cursor-pointer"
            />
            {fileName && (
                <p className="mt-2 text-xs text-gray-600">
                    File loaded: <span className="font-semibold">{fileName}</span>
                    <button
                        onClick={() => {setFileBase64(null); setFileName('');}}
                        className="ml-2 text-red-500 hover:text-red-700 text-xs"
                    >
                        [Remove]
                    </button>
                </p>
            )}
          </div>

          {/* --- Action Buttons: Reset and Generate --- */}
          <div className="mt-8 flex space-x-4">
            <button
              onClick={resetForm}
              disabled={loading}
              className="w-1/3 flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-custom-blue transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={generateCopy}
              disabled={loading || !productName || !keyBenefit}
              className={`w-2/3 flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-md text-white transition-all
                ${loading ? 'bg-custom-blue/70 cursor-not-allowed' : 'bg-custom-blue hover:bg-custom-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-custom-blue'}`}
              style={{ backgroundColor: loading ? '#371ee1' : '#371ee1' }} // Explicit background for custom color
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Ad Copies...
                </>
              ) : (
                'Generate variants'
              )}
            </button>
          </div>
        </div>

        {/* --- Error Display --- */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-8" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {/* --- Results Display --- */}
        {adCopies.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2 mb-6">Generated Ad Variants</h2>
            {adCopies.map((copy, index) => (
              <div key={index} className="copy-card bg-white p-6 rounded-xl border-t-4 border-custom-blue shadow-md">
                <span className="inline-flex items-center rounded-full bg-custom-blue/10 px-3 py-1 text-sm font-semibold text-custom-blue mb-4">
                  Variant {index + 1}: {copy.style}
                </span>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">{copy.headline}</h3>
                <p className="text-gray-600 mb-4 whitespace-pre-wrap">{copy.bodyCopy}</p>
                
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-lg font-semibold text-green-600">
                    {copy.callToAction}
                  </span>
                  <button
                    onClick={() => copyToClipboard(copy)}
                    className="ml-4 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- Copy Confirmation Toast --- */}
        {copyStatus && (
            <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-opacity duration-300 ${copyStatus.includes('failed') ? 'bg-red-500' : 'bg-green-600'} text-white px-4 py-2 rounded-lg shadow-xl`}>
                {copyStatus}
            </div>
        )}
    </div>
  );
};

// ----------------------------------------------------------------------
// --- MODULE 2: Marketing Trend Analysis Component ---------------------
// ----------------------------------------------------------------------

const NewsAnalyser = ({ sendToContentGenerator }) => {
    const [topic, setTopic] = useState('Digital trends within the logistics industry');
    
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState('');
    const [sources, setSources] = useState([]);
    const [error, setError] = useState('');

    const analyseNews = async () => {
        setLoading(true);
        setSummary('');
        setSources([]);
        setError('');

        // Query simplified to remove dateRange variable
        const userQuery = `Find recent news, trends, and articles about "${topic}". Synthesize the findings into a concise, actionable marketing strategy summary. Highlight 3 key insights.`;

        // System prompt uses Australian English
        const systemPrompt = "You are a professional market research analyst for CargoWise, targeting Logistics and Freight Forwarding Companies. Provide a single, well-structured, easy-to-read summary that converts the research into marketing strategy recommendations. The output must be formatted using Markdown. Start with '**Executive Summary**', followed by '**Key Strategic Insights**'. For each strategic insight, use a Markdown bullet point (*) and clearly label the content using the format: **Action/Insight:** and **Recommendation/Marketing Strategy:**. **Crucially, all responses must be in Australian English.**";

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            // Enable Google Search grounding for real-time data
            tools: [{ "google_search": {} }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        try {
            // Use the global apiUrl for grounding
            const response = await fetchWithRetry(apiUrl, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const candidate = response.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const text = candidate.content.parts[0].text;
                setSummary(text);

                // Extract grounding sources
                let extractedSources = [];
                const groundingMetadata = candidate.groundingMetadata;
                if (groundingMetadata && groundingMetadata.groundingAttributions) {
                    extractedSources = groundingMetadata.groundingAttributions
                        .map(attribution => ({
                            uri: attribution.web?.uri,
                            title: attribution.web?.title,
                        }))
                        .filter(source => source.uri && source.title);
                }
                setSources(extractedSources);

            } else {
                throw new Error("Failed to receive content from the model.");
            }

        } catch (err) {
            console.error('News Analysis Error:', err);
            setError(`Failed to analyse news: ${err.message}. Ensure your API key is valid.`);
        } finally {
            setLoading(false);
        }
    };

    const splitSummaryIntoInsights = (rawSummary) => {
        if (!rawSummary) return [];
        
        // 1. Find the start of the key strategic insights section
        const insightsStartRegex = /^\*\*Key Strategic Insights\*\*[\s\n]*/im;
        const match = rawSummary.match(insightsStartRegex);
        
        // If the Key Strategic Insights header isn't found, return empty array (or intro text if needed)
        if (!match) {
            const introMatch = rawSummary.match(/Executive Summary[\s\n]*/i);
            if (introMatch) {
                 const introText = rawSummary.substring(introMatch.index + introMatch[0].length).trim();
                 return [introText];
            }
            return []; 
        }
        
        const contentAfterHeader = rawSummary.substring(match.index + match[0].length).trim();
        
        // Split by the bullet point structure (*)
        const insights = contentAfterHeader.split('\n*').map(s => s.trim()).filter(s => s.length > 0);
        
        // Re-add the bullet point structure and clean the arrays
        return insights.map((insight, index) => {
            // Re-add the bullet point (*) to ensure our renderMarkdown logic finds the start of the block
            return (index > 0 ? '*' : '') + insight;
        }).filter(s => s.length > 0);
    };

    const insightBlocks = splitSummaryIntoInsights(summary);
    const hasIntroText = insightBlocks.length > 0 && !insightBlocks[0].trim().startsWith('*');
    const introText = hasIntroText ? insightBlocks[0] : '';
    const strategicInsights = hasIntroText ? insightBlocks.slice(1) : insightBlocks;


    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            {/* Title updated */}
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Marketing Trend Analysis</h2>
            {/* SUBTITLE UPDATED HERE */}
            <p className="text-lg text-green-600 mb-8">
                Get real-time, actionable marketing insights
            </p>

            <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-200">
                {/* Simplified layout - removed date range column */}
                <label htmlFor="topic" className="block text-sm font-medium text-gray-700">Marketing Topic / Trend to Analyse</label>
                <input
                    id="topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-3 border"
                    placeholder="e.g., Q3 TikTok advertising results"
                />
                
                <button
                    onClick={analyseNews}
                    disabled={loading || !topic}
                    className={`mt-6 w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-md text-white transition-all
                      ${loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'}`}
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analysing Trends...
                        </>
                    ) : (
                        'Analyse Marketing Trends'
                    )}
                </button>
            </div>

            {/* --- Error Display --- */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-8" role="alert">
                <strong className="font-bold">Error:</strong>
                <span className="block sm:inline ml-2">{error}</span>
              </div>
            )}
            
            {/* --- Results Display --- */}
            {(summary || loading) && (
                <div className="copy-card bg-white p-6 rounded-xl border-t-4 border-green-500 shadow-md">
                    {/* Display Topic as styled tag */}
                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700 mb-4 mr-2">
                        Topic: {topic}
                    </span>
                    
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">
                            <svg className="animate-spin mx-auto h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="mt-2">Fetching and synthesising latest news...</p>
                        </div>
                    ) : (
                        <>
                            {/* Render Executive Summary if present */}
                            {introText && (
                                <div className="mb-6">
                                    <h4 className="text-lg font-bold mt-4 mb-2">Executive Summary</h4>
                                    {renderMarkdown(introText)} 
                                </div>
                            )}

                            {/* Render Key Strategic Insights Header */}
                            {strategicInsights.length > 0 && (
                                <h4 className="text-lg font-bold mt-4 mb-2 border-t pt-4">Key Strategic Insights</h4>
                            )}
                            
                            {/* --- INDIVIDUAL INSIGHT CARDS (NEW STRUCTURE) --- */}
                            <div className="space-y-4">
                                {strategicInsights.map((insightMarkdown, index) => (
                                    <div 
                                        key={`insight-card-${index}`} 
                                        className="copy-card bg-white p-4 rounded-xl border border-gray-200 shadow-sm"
                                    >
                                        {/* Render each individual insight block using the existing function */}
                                        {renderMarkdown(insightMarkdown, sendToContentGenerator)}
                                        <div className="flex justify-end pt-4 border-t mt-4">
                                             <button
                                                onClick={() => sendToContentGenerator(insightMarkdown)}
                                                className="px-3 py-1 text-sm font-semibold rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors shadow-md"
                                            >
                                                Send to Content Generator
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {sources.length > 0 && (
                                <div className="mt-6 pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-600 mb-2">Sources (for grounding)</h4>
                                    <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                                        {sources.map((source, index) => (
                                            <li key={index}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:text-green-600 transition-colors underline flex items-center space-x-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.793 4.793a4.5 4.5 0 01-6.364-6.364l1.625-1.625m1.625 1.625l5.242-5.242m-5.242 5.242a4.5 4.5 0 006.364-6.364l-4.793-4.793a4.5 4.5 0 00-7.244 1.242" />
                                                    </svg>
                                                    <span>{source.title}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};


// ----------------------------------------------------------------------
// --- MODULE 3: Home Component -----------------------------------------
// ----------------------------------------------------------------------

const HomeView = ({ setActiveModule }) => (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to the AI Marketing Toolkit</h2>
        <p className="text-gray-600 mb-8">
            This home screen is your central hub for generative AI tools designed to optimise your marketing workflows. Select a module from the menu to get started.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div 
                className="bg-white p-6 rounded-xl shadow-md border-l-4 border-custom-blue hover:shadow-lg cursor-pointer transition-shadow"
                onClick={() => setActiveModule('AdCopyGenerator')}
            >
                <h3 className="text-xl font-semibold text-custom-blue">Ad Copy Generator</h3>
                <p className="text-gray-500 mt-2">Generate multiple, distinct headline and body copy variants for A/B testing.</p>
            </div>

            <div 
                className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500 hover:shadow-lg cursor-pointer transition-shadow"
                onClick={() => setActiveModule('MarketingTrendAnalysis')}
            >
                <h3 className="text-xl font-semibold text-green-600">Marketing Trend Analysis</h3>
                <p className="text-gray-500 mt-2">Get real-time market insights and actionable strategies from the latest news.</p>
            </div>
            
             <div 
                className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500 hover:shadow-lg cursor-pointer transition-shadow"
                onClick={() => setActiveModule('ContentGenerator')}
            >
                <h3 className="text-xl font-semibold text-red-600">Content Generator</h3>
                <p className="text-gray-500 mt-2">Draft high-impact marketing content tailored for logistics executives.</p>
            </div>
        </div>
    </div>
);

// ----------------------------------------------------------------------
// --- MODULE 4: Content Generator (Placeholder) ------------------------
// ----------------------------------------------------------------------

const ContentGenerator = ({ initialPrompt, setInitialPrompt }) => {
    const defaultPrompt = "Generate a compelling piece of content targeting Freight Forwarding executives about the strategic need for supply chain visibility and automation.";
    const [prompt, setPrompt] = useState(initialPrompt || defaultPrompt);
    // NEW STATE: Content Type Selection
    const [contentType, setContentType] = useState(CONTENT_TYPES[0].value);
    
    const [loading, setLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState('');
    const [error, setError] = useState('');

    // Find the currently selected content type details
    const selectedType = CONTENT_TYPES.find(t => t.value === contentType) || CONTENT_TYPES[0];

    // Update local prompt state when initialPrompt changes (i.e., when sent from NewsAnalyser)
    React.useEffect(() => {
        if (initialPrompt) {
            // Prepend a clear instruction for the model when transferring insight data
            const fullPrompt = `Convert the following Strategic Insight into a ready-to-publish ${selectedType.value}. Maintain a professional, executive-level tone and focus on CargoWise's value proposition:\n\n---\n${initialPrompt}\n---`;
            setPrompt(fullPrompt);
            setInitialPrompt(''); // Clear the parent state after setting local state
            setGeneratedContent(''); // Clear previous results
        }
    }, [initialPrompt, setInitialPrompt, selectedType.value]);
    
    // Logic to run content generation
    const generateContent = async () => {
        setLoading(true);
        setGeneratedContent('');
        setError('');

        const userQuery = prompt; // Use the text area content as the main query
        
        const systemPrompt = `You are an expert B2B content strategist and writer for a leading logistics software company (CargoWise). 
            Your task is to generate a piece of content that matches the format: ${selectedType.value} and the tone: ${selectedType.tone}.
            The content must be polished, high-impact, and designed to drive engagement and demonstrate thought leadership to freight forwarding executives. 
            Output must be in Australian English and formatted using Markdown.`;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        try {
            const response = await fetchWithRetry(apiUrl, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Failed to receive content from the model.");
            }
            setGeneratedContent(text);

        } catch (err) {
            console.error('Content Generation Error:', err);
            setError(`Content Generation Failed: ${err.message}.`);
        } finally {
            setLoading(false);
        }
    };

    // Helper to copy generated content to clipboard
    const copyGeneratedContent = () => {
        const textToCopy = generatedContent;
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            // Replaced alert with console log to prevent modal errors
            console.log('Content Copied to Clipboard!'); 
          }
        } catch (err) {
          console.error('Could not copy content: ', err);
        } finally {
          document.body.removeChild(textArea);
        }
    };


    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Content Generator</h2>
            <p className="text-lg text-red-600 mb-8">
                Draft high-impact marketing content tailored for logistics executives.
            </p>

            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-2">
                        <label htmlFor="contentType" className="block text-sm font-medium text-gray-700">Content Type</label>
                        <select
                            id="contentType"
                            value={contentType}
                            onChange={(e) => setContentType(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-3 border bg-white"
                        >
                            {CONTENT_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Target Tone</label>
                        <p className="mt-1 block w-full rounded-md border-gray-300 p-3 bg-gray-50 text-xs text-gray-600 h-10 flex items-center">
                            {selectedType.tone}
                        </p>
                    </div>
                </div>

                <label htmlFor="contentPrompt" className="block text-sm font-medium text-gray-700 mb-2">Source Insight / Content Prompt</label>
                <textarea
                    id="contentPrompt"
                    rows="8"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-3 border"
                    placeholder={defaultPrompt}
                />
                
                <button 
                    onClick={generateContent}
                    disabled={loading || !prompt}
                    className={`mt-4 w-full flex items-center justify-center py-2 px-4 rounded-lg shadow-md text-white transition-all
                        ${loading ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                >
                     {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Drafting Content...
                        </>
                    ) : (
                        'Generate Content Draft'
                    )}
                </button>
            </div>
            
            {/* --- Content Output --- */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mt-8" role="alert">
                <strong className="font-bold">Error:</strong>
                <span className="block sm:inline ml-2">{error}</span>
              </div>
            )}
            
            {generatedContent && (
                // Match Ad Copy Generator structure: copy-card + border-t-4
                <div className="copy-card bg-white p-6 rounded-xl border-t-4 border-red-500 shadow-md mt-8">
                    {/* Display Content Type and Tone as styled tags */}
                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 mb-4 mr-2">
                        Format: {selectedType.label}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 mb-4">
                        Tone: {selectedType.tone.split(',')[0]}
                    </span>

                    <h3 className="text-xl font-bold text-gray-900 mb-2">Generated Content</h3>
                    
                    <div className="text-gray-600 mb-4 whitespace-pre-wrap border p-3 rounded-lg bg-gray-50">
                        {/* Rendering Markdown content (summary) using the custom renderer */}
                        {renderMarkdown(generatedContent)}
                    </div>
                    
                    <div className="flex items-center justify-end border-t pt-4">
                        <button
                            onClick={copyGeneratedContent}
                            className="ml-4 px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


// ----------------------------------------------------------------------
// --- MAIN APPLICATION COMPONENT ---------------------------------------
// ----------------------------------------------------------------------

const App = () => {
    const [activeModule, setActiveModule] = useState('Home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
    const [contentGeneratorPrompt, setContentGeneratorPrompt] = useState(''); // State to pass data

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    // Function used by NewsAnalyser to switch module and pass prompt
    const sendToContentGenerator = (insightText) => {
        // Prepare the raw insight text to be formatted in the ContentGenerator module
        setContentGeneratorPrompt(insightText);
        
        setActiveModule('ContentGenerator');
    };

    const modules = {
        'Home': <HomeView setActiveModule={setActiveModule} />,
        'AdCopyGenerator': <AdCopyGenerator />,
        // Pass the function down to the NewsAnalyser
        'MarketingTrendAnalysis': <NewsAnalyser sendToContentGenerator={sendToContentGenerator} />, 
        // Pass the prompt state down to ContentGenerator
        'ContentGenerator': <ContentGenerator 
            initialPrompt={contentGeneratorPrompt} 
            setInitialPrompt={setContentGeneratorPrompt}
        />, 
    };

    const navItems = [
        { 
            id: 'Home', 
            name: 'Home',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        { id: 'AdCopyGenerator', name: 'Ad Copy Generator' },
        { id: 'MarketingTrendAnalysis', name: 'Marketing Trend Analysis' }, 
        { id: 'ContentGenerator', name: 'Content Generator' }, // New Navigation Item
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* The style block below is used for custom shadows and to define the custom color. */}
            <style>
            {`
                .copy-card {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06);
                }
                .text-custom-blue { color: #371ee1; }
                .bg-custom-blue { background-color: #371ee1; }
                .hover\\:bg-custom-blue\\/90:hover { background-color: rgba(55, 30, 225, 0.9); }
                .focus\\:ring-custom-blue:focus { --tw-ring-color: #371ee1; }
                .border-custom-blue { border-color: #371ee1; }
                .bg-custom-blue\\/10 { background-color: rgba(55, 30, 225, 0.1); }
            `}
            </style>

            {/* --- Sidebar Navigation --- */}
            <div className={`
                bg-white shadow-xl border-r border-gray-200 p-4 transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}
                hidden md:block 
            `}>
                {/* Inner content div which is hidden when sidebar is collapsed */}
                <div className={isSidebarOpen ? 'w-64' : 'hidden'}> 
                    <div className="text-2xl font-extrabold text-custom-blue mb-8 p-2 flex justify-between items-center">
                        AI Toolkit
                        {/* Collapse button visible when sidebar is OPEN on desktop */}
                        <button 
                            onClick={toggleSidebar} 
                            className="p-1 text-gray-700 rounded-full hover:bg-gray-100 hidden md:block"
                            title="Hide Sidebar"
                        >
                            {/* Collapse Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>
                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveModule(item.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center
                                    ${activeModule === item.id
                                        ? 'bg-custom-blue text-white shadow-md'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                style={activeModule === item.id ? {backgroundColor: '#371ee1'} : {}}
                            >
                                {item.icon}
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* --- Main Content Area --- */}
            <div className="flex-1 overflow-y-auto">
                <header className="bg-white shadow-sm p-4 border-b">
                    {/* Desktop Header Row (Hidden on Mobile) */}
                    <div className="hidden md:flex items-center justify-between">
                        <div className="flex items-center">
                            {/* Toggle button visible when sidebar is CLOSED on desktop */}
                            {!isSidebarOpen && (
                                <button 
                                    onClick={toggleSidebar} 
                                    className="p-1 mr-4 text-gray-700 rounded-full hover:bg-gray-100"
                                    title="Show Sidebar"
                                >
                                    {/* Menu Icon SVG */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            )}
                            <h1 className="text-xl font-bold text-gray-900">
                                {navItems.find(item => item.id === activeModule)?.name}
                            </h1>
                        </div>
                    </div>
                    
                    {/* Mobile Layout (Visible only on Mobile) */}
                    <div className="md:hidden">
                        <h1 className="text-xl font-bold text-gray-900 mb-2">
                            {navItems.find(item => item.id === activeModule)?.name}
                        </h1>
                        <div className="flex space-x-2 overflow-x-auto pb-1">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveModule(item.id)}
                                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors 
                                        ${activeModule === item.id
                                            ? 'bg-custom-blue text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    style={activeModule === item.id ? {backgroundColor: '#371ee1'} : {}}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>
                
                
                <main className="pb-10">
                    {modules[activeModule]}
                </main>
            </div>
        </div>
    );
};

export default App;