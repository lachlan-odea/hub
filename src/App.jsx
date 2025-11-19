import React, { useState } from 'react';

// --- Global Configuration (Mandatory Setup) ---
// This assumes the Gemini API key will be available in the environment.
const apiKey = "AIzaSyCG5jFwxIMO9_BVl6odE3uoiI4W0iJiH28"; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// The JSON schema ensures the model returns a predictable array of copy objects.
const responseSchema = {
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

// --- Module 1: Ad Copy Generator Component ---

const AdCopyGenerator = () => {
  const defaultProductName = 'Sustainable Bamboo Toothbrush';
  const defaultKeyBenefit = 'Reduces plastic waste and looks great on your counter.';
  const defaultTargetAudience = 'Eco-conscious millennials who prioritize design.';
  const defaultTone = 'Friendly, modern, and inspiring.';
  const defaultNumVariants = 3; 

  const [productName, setProductName] = useState(defaultProductName);
  const [keyBenefit, setKeyBenefit] = useState(defaultKeyBenefit);
  const [targetAudience, setTargetAudience] = useState(defaultTargetAudience);
  const [tone, setTone] = useState(defaultTone);
  const [numVariants, setNumVariants] = useState(defaultNumVariants); 
  
  const [loading, setLoading] = useState(false);
  const [adCopies, setAdCopies] = useState([]);
  const [error, setError] = useState('');
  // STATE: To show copy confirmation status
  const [copyStatus, setCopyStatus] = useState(''); 

  // Exponential backoff retry mechanism for API calls
  const fetchWithRetry = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
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

  const generateCopy = async () => {
    setLoading(true);
    setAdCopies([]);
    setError('');

    // Dynamically insert the number of variants into the prompt
    const userQuery = `Generate exactly ${numVariants} distinct ad copy variants for the following product. Ensure the copy is highly persuasive and suitable for social media ads (Facebook/Instagram/X).
      
      - Product Name: ${productName}
      - Key Benefit: ${keyBenefit}
      - Target Audience: ${targetAudience}
      - Tone: ${tone}
      
      The variants should be distinct from each other, using different styles, tones, or focuses (e.g., Short & Punchy, Emotional Story, Detailed Feature Set).`;

    const systemPrompt = "You are a world-class advertising copywriter specializing in highly effective A/B tested ad concepts. Your task is to analyze the product details and generate exactly the requested number of distinct ad copy variants in the provided JSON format.";

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    };

    try {
      const response = await fetchWithRetry(apiUrl, {
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
  };
  
  // FIX: Using document.execCommand('copy') for better compatibility in iFrame/sandbox environments
  const copyToClipboard = (copy) => {
    const textToCopy = `Headline: ${copy.headline}\nBody: ${copy.bodyCopy}\nCTA: ${copy.callToAction}`;
    
    // Create a temporary textarea element
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    
    // Make the textarea invisible and append it to the document
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    
    // Select the text and execute the copy command
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        // Set success notification
        setCopyStatus('Copied to Clipboard!');
        setTimeout(() => setCopyStatus(''), 3000);
      } else {
        // Set failure notification
        setCopyStatus('Copy failed.');
        setTimeout(() => setCopyStatus(''), 3000);
      }
    } catch (err) {
      // Set error notification
      setCopyStatus('Copy failed: See console for details.');
      setTimeout(() => setCopyStatus(''), 3000);
      console.error('Could not copy text using execCommand: ', err);
    }
    
    // Clean up: remove the temporary element
    document.body.removeChild(textArea);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto relative">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Ad Copy Generator</h2>
        <p className="text-lg text-indigo-600 mb-8">
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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                placeholder="e.g., Sustainable Bamboo Toothbrush"
              />
            </div>
            <div>
              <label htmlFor="keyBenefit" className="block text-sm font-medium text-gray-700">Core Benefit/Value Proposition</label>
              <input
                id="keyBenefit"
                type="text"
                value={keyBenefit}
                onChange={(e) => setKeyBenefit(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                placeholder="e.g., Reduces plastic waste and looks great."
              />
            </div>
            
            {/* New Row for Target, Tone, and Variant Count */}
            <div>
              <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700">Target Audience</label>
              <input
                id="targetAudience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                placeholder="e.g., Eco-conscious millennials"
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
                        // Clamps input between 1 and 5
                        onChange={(e) => setNumVariants(Math.max(1, Math.min(5, Number(e.target.value))))} 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                        placeholder="e.g., Friendly, modern..."
                    />
                </div>
            </div>
          </div>

          {/* --- Action Buttons: Reset and Generate --- */}
          <div className="mt-8 flex space-x-4">
            <button
              onClick={resetForm}
              disabled={loading}
              className="w-1/3 flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={generateCopy}
              disabled={loading || !productName || !keyBenefit}
              className={`w-2/3 flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-md text-white transition-all
                ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
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
              <div key={index} className="copy-card bg-white p-6 rounded-xl border-t-4 border-indigo-500 shadow-md">
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-800 mb-4">
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

// --- Module 2: Home Component ---

const HomeView = ({ setActiveModule }) => (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to the AI Marketing Toolkit</h2>
        <p className="text-gray-600 mb-8">
            This home screen is your central hub for generative AI tools designed to optimize your marketing workflows. Select a module from the menu to get started.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
                className="bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500 hover:shadow-lg cursor-pointer transition-shadow"
                onClick={() => setActiveModule('AdCopyGenerator')}
            >
                <h3 className="text-xl font-semibold text-indigo-600">Ad Copy Generator</h3>
                <p className="text-gray-500 mt-2">Generate multiple, distinct headline and body copy variants for A/B testing.</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-gray-400">
                <h3 className="text-xl font-semibold text-gray-600">Content Planner (Coming Soon)</h3>
                <p className="text-gray-500 mt-2">Plan your social media posts, blog topics, and email campaigns.</p>
            </div>
        </div>
    </div>
);

// --- Main Application Component ---

const App = () => {
    const [activeModule, setActiveModule] = useState('Home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // State to control sidebar visibility

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const modules = {
        'Home': <HomeView setActiveModule={setActiveModule} />,
        'AdCopyGenerator': <AdCopyGenerator />,
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
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* The style block below is used for custom shadows not available in standard Tailwind. */}
            <style>
            {`
                .copy-card {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06);
                }
            `}
            </style>

            {/* --- Sidebar Navigation --- */}
            <div className={`
                bg-white shadow-xl border-r border-gray-200 p-4 transition-all duration-300 ease-in-out
                // Conditional width for desktop (md+)
                ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}
                hidden md:block 
            `}>
                {/* Inner content div which is hidden when sidebar is collapsed */}
                <div className={isSidebarOpen ? 'w-64' : 'hidden'}> 
                    <div className="text-2xl font-extrabold text-indigo-700 mb-8 p-2 flex justify-between items-center">
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
                                        ? 'bg-indigo-500 text-white shadow-md'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
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
                        {/* Could add user profile/settings here */}
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
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
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