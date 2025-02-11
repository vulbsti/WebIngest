import { useState } from 'react'
import './App.css'

interface QAItem {
  question: string;
  answer: string;
}

function App() {
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3000/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: newUrl }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setUrls([...urls, newUrl]);
        setNewUrl('');
      } else {
        setError(data.message || 'Failed to ingest URL');
      }
    } catch (error) {
      setError('Network error while ingesting URL. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || urls.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();
      setQaHistory([...qaHistory, { question, answer: data.answer }]);
      setQuestion('');
    } catch (error) {
      alert('Error getting answer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Web Content Q&A Tool</h1>
      
      {/* URL Input Form */}
      <section className="url-section">
        <h2>Add URLs to Analyze</h2>
        <form onSubmit={handleAddUrl}>
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Enter URL to analyze"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Add URL'}
          </button>
        </form>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {/* URL List */}
        <div className="url-list">
          <h3>Ingested URLs:</h3>
          <ul>
            {urls.map((url, index) => (
              <li key={index}>{url}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Q&A Section */}
      <section className="qa-section">
        <h2>Ask Questions</h2>
        <form onSubmit={handleAskQuestion}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the content"
            required
          />
          <button type="submit" disabled={loading || urls.length === 0}>
            Ask Question
          </button>
        </form>

        {/* Q&A History */}
        <div className="qa-history">
          {qaHistory.map((qa, index) => (
            <div key={index} className="qa-item">
              <p className="question">Q: {qa.question}</p>
              <p className="answer">A: {qa.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default App
