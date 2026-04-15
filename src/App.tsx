import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  BookOpen, 
  History, 
  Plus, 
  Trash2, 
  Printer, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X,
  RefreshCw,
  Save,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDocFromServer
} from 'firebase/firestore';
import { aiService } from './services/aiService';
import { WrongQuestion, OCRResult, Variation } from './types';
import { cn } from './lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">出错了</h1>
          <p className="text-red-700 mb-4 max-w-md">
            {this.state.error?.message || "发生了一个未知错误。"}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors"
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main App ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recognition' | 'notebook'>('recognition');
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    if (!isAuthReady || !user) {
      setQuestions([]);
      return;
    }

    const q = query(
      collection(db, 'wrongQuestions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WrongQuestion));
      setQuestions(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wrongQuestions');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // 使用 signInWithPopup，如果是在 iframe 中可能会有问题，但在 Vercel 独立域名下通常 OK
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login failed", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-blue-200">
          <BookOpen className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">错题举一反三打印机</h1>
        <p className="text-slate-500 mb-8 text-center max-w-xs">
          拍照识错题，智能生成变式练习，助你彻底掌握知识点。
        </p>
        <button 
          onClick={handleLogin}
          className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold shadow-sm hover:bg-slate-50 transition-all active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
          使用 Google 账号登录
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 pb-24">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">错题打印机</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => auth.signOut()}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="退出登录"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-slate-200" alt="Avatar" referrerPolicy="no-referrer" />
          </div>
        </header>

        {/* Content */}
        <main className="max-w-2xl mx-auto p-4">
          {activeTab === 'recognition' ? (
            <RecognitionPage user={user} />
          ) : (
            <NotebookPage questions={questions} user={user} />
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <NavButton 
            active={activeTab === 'recognition'} 
            onClick={() => setActiveTab('recognition')}
            icon={<Camera className="w-6 h-6" />}
            label="错题识别"
          />
          <NavButton 
            active={activeTab === 'notebook'} 
            onClick={() => setActiveTab('notebook')}
            icon={<History className="w-6 h-6" />}
            label="错题本"
          />
        </nav>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

function VariationCard({ v, index, showDefault = false }: { v: Variation, index: number, showDefault?: boolean }) {
  const [showAnalysis, setShowAnalysis] = useState(showDefault);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
            {index + 1}
          </span>
          <span className="text-sm font-bold text-slate-400 uppercase">变式题</span>
        </div>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
          v.difficulty === '简单' ? "bg-green-50 text-green-600" :
          v.difficulty === '中等' ? "bg-amber-50 text-amber-600" :
          "bg-red-50 text-red-600"
        )}>
          {v.difficulty}
        </span>
      </div>
      <div className="prose prose-slate max-w-none">
        <ReactMarkdown>{v.question}</ReactMarkdown>
      </div>
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50">
          <p className="text-xs font-bold text-amber-600 uppercase mb-1 flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> 思路引导
          </p>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            <ReactMarkdown>{v.explanation}</ReactMarkdown>
          </div>
        </div>

        {!showAnalysis ? (
          <button 
            onClick={() => setShowAnalysis(true)}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
          >
            <ChevronRight className="w-4 h-4" /> 查看解题过程与答案
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4 overflow-hidden"
          >
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase">解题步骤</p>
              <div className="space-y-1">
                {v.steps.map((step, sIdx) => (
                  <div key={sIdx} className="flex gap-2 text-sm text-slate-600">
                    <span className="text-blue-400 font-bold">{sIdx + 1}.</span>
                    <div className="whitespace-pre-wrap">
                      <ReactMarkdown>{step}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase">最终答案</span>
              <p className="text-sm text-slate-700 font-bold">{v.answer}</p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function VariationCardDetail({ v, index }: { v: Variation, index: number }) {
  const [showAnalysis, setShowAnalysis] = useState(false);

  return (
    <div className="border border-slate-100 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold">
          {index + 1}
        </span>
        <span className="text-xs font-bold text-slate-400 uppercase">变式练习</span>
        <span className={cn(
          "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ml-auto",
          v.difficulty === '简单' ? "bg-green-50 text-green-600" :
          v.difficulty === '中等' ? "bg-amber-50 text-amber-600" :
          "bg-red-50 text-red-600"
        )}>
          {v.difficulty}
        </span>
      </div>
      <div className="prose prose-sm prose-slate max-w-none">
        <ReactMarkdown>{v.question}</ReactMarkdown>
      </div>
      <div className="mt-4 space-y-4">
        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/30">
          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">思路引导</p>
          <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            <ReactMarkdown>{v.explanation}</ReactMarkdown>
          </div>
        </div>

        {!showAnalysis ? (
          <button 
            onClick={() => setShowAnalysis(true)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            查看解题过程与答案
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3 overflow-hidden"
          >
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">解题步骤</p>
              <div className="space-y-1">
                {v.steps.map((step, sIdx) => (
                  <div key={sIdx} className="flex gap-2 text-xs text-slate-600">
                    <span className="text-blue-400 font-bold">{sIdx + 1}.</span>
                    <div className="whitespace-pre-wrap">
                      <ReactMarkdown>{step}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs font-bold text-green-600 mt-2">答案：{v.answer}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-blue-600" : "text-slate-400"
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function RecognitionPage({ user }: { user: User }) {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setImage(base64);
        processOCR(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const processOCR = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setError(null);
    setOcrResult(null);
    setVariations([]);
    try {
      const result = await aiService.recognizeQuestion(base64, mimeType);
      setOcrResult(result);
    } catch (err: any) {
      setError(err.message || "识别失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateVariations = async () => {
    if (!ocrResult) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await aiService.generateVariations(ocrResult.text, ocrResult.knowledgePoint);
      setVariations(result);
    } catch (err: any) {
      setError(err.message || "生成变式题失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToNotebook = async () => {
    if (!ocrResult || variations.length === 0) return;
    setIsSaving(true);
    try {
      const questionData: Omit<WrongQuestion, 'id'> = {
        userId: user.uid,
        originalQuestion: ocrResult.text,
        imageUrl: image || undefined,
        options: ocrResult.options,
        userAnswer: ocrResult.userAnswer,
        correctAnswer: ocrResult.correctAnswer,
        knowledgePoint: ocrResult.knowledgePoint,
        variations: variations,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'wrongQuestions'), questionData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'wrongQuestions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 flex flex-col items-center justify-center gap-4 relative overflow-hidden min-h-[240px]">
        {image ? (
          <div className="w-full space-y-4">
            <div className="relative group rounded-2xl overflow-hidden border border-slate-100 shadow-inner bg-slate-50">
              <img src={image} className="w-full h-auto max-h-[400px] object-contain mx-auto" alt="Uploaded" referrerPolicy="no-referrer" />
              <button 
                onClick={() => { setImage(null); setOcrResult(null); setVariations([]); }}
                className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-600 shadow-sm hover:bg-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              图片已就绪
            </div>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-semibold">上传错题图片</p>
              <p className="text-slate-500 text-sm">支持拍照或从相册选择</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
              >
                选择图片
              </button>
            </div>
          </>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 flex items-center gap-4">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-slate-600 font-medium">正在识别题目内容...</span>
        </div>
      )}

      {/* OCR Result */}
      {ocrResult && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              识别结果
            </h3>
            <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-wider">
              {ocrResult.knowledgePoint}
            </span>
          </div>
          
          <div className="space-y-3">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">题目内容</p>
              <textarea 
                value={ocrResult.text}
                onChange={(e) => setOcrResult({ ...ocrResult, text: e.target.value })}
                className="w-full bg-transparent border-none focus:ring-0 text-slate-700 resize-none min-h-[100px]"
              />
            </div>

            {ocrResult.options && ocrResult.options.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">选项</p>
                <div className="grid grid-cols-1 gap-2">
                  {ocrResult.options.map((opt, i) => (
                    <input 
                      key={i}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...ocrResult.options!];
                        newOpts[i] = e.target.value;
                        setOcrResult({ ...ocrResult, options: newOpts });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">你的答案</p>
                <input 
                  value={ocrResult.userAnswer || ''}
                  onChange={(e) => setOcrResult({ ...ocrResult, userAnswer: e.target.value })}
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-700 font-medium"
                  placeholder="未识别到"
                />
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">标准答案</p>
                <input 
                  value={ocrResult.correctAnswer || ''}
                  onChange={(e) => setOcrResult({ ...ocrResult, correctAnswer: e.target.value })}
                  className="w-full bg-transparent border-none focus:ring-0 text-blue-600 font-bold"
                  placeholder="未识别到"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={generateVariations}
            disabled={isGenerating}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            生成举一反三题目
          </button>
        </motion.div>
      )}

      {/* Variations */}
      {variations.length > 0 && (
        <div className="space-y-4 pb-12">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-900">举一反三变式题</h3>
            <button 
              onClick={generateVariations}
              className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:underline"
            >
              <RefreshCw className="w-4 h-4" /> 重新生成
            </button>
          </div>

          {variations.map((v, i) => (
            <VariationCard key={i} v={v} index={i} />
          ))}

          <button 
            onClick={saveToNotebook}
            disabled={isSaving || saveSuccess}
            className={cn(
              "w-full py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2",
              saveSuccess 
                ? "bg-green-500 text-white shadow-green-100" 
                : "bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800"
            )}
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : saveSuccess ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saveSuccess ? "已保存到错题本" : "保存全部到错题本"}
          </button>
        </div>
      )}
    </div>
  );
}

function NotebookPage({ questions, user }: { questions: WrongQuestion[], user: User }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [viewingQuestion, setViewingQuestion] = useState<WrongQuestion | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualQuestion, setManualQuestion] = useState({
    text: '',
    knowledgePoint: '',
    correctAnswer: '',
  });
  const printRef = useRef<HTMLDivElement>(null);

  const handleManualSave = async () => {
    if (!manualQuestion.text || !manualQuestion.knowledgePoint) return;
    try {
      const questionData: Omit<WrongQuestion, 'id'> = {
        userId: user.uid,
        originalQuestion: manualQuestion.text,
        knowledgePoint: manualQuestion.knowledgePoint,
        correctAnswer: manualQuestion.correctAnswer,
        variations: [],
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'wrongQuestions'), questionData);
      setIsAddingManual(false);
      setManualQuestion({ text: '', knowledgePoint: '', correctAnswer: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'wrongQuestions');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === questions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions.map(q => q.id!));
    }
  };

  const deleteQuestion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // 使用简单的状态来处理删除确认，或者直接删除（如果用户不喜欢确认弹窗）
    // 这里我们先直接删除，或者可以加一个更现代的 UI
    try {
      await deleteDoc(doc(db, 'wrongQuestions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'wrongQuestions');
    }
  };

  const generatePDF = async () => {
    if (selectedIds.length === 0) return;
    setIsPrinting(true);
    
    // Wait for DOM to render the print content
    setTimeout(async () => {
      try {
        const element = printRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = pdfHeight;
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`错题本_${new Date().toLocaleDateString()}.pdf`);
      } catch (error) {
        console.error("PDF generation failed", error);
      } finally {
        setIsPrinting(false);
      }
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 sticky top-[72px] z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={selectAll}
            className="w-5 h-5 border-2 border-slate-300 rounded flex items-center justify-center transition-colors"
          >
            {selectedIds.length === questions.length && questions.length > 0 && (
              <div className="w-3 h-3 bg-blue-600 rounded-sm" />
            )}
          </button>
          <span className="text-sm font-bold text-slate-700">
            {selectedIds.length > 0 ? `已选 ${selectedIds.length} 项` : "全选"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddingManual(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
          >
            <Plus className="w-4 h-4" />
            手动添加
          </button>
          <button 
            onClick={generatePDF}
            disabled={selectedIds.length === 0 || isPrinting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 disabled:opacity-50 transition-all active:scale-95"
          >
            {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            导出 PDF
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p>还没有保存过错题</p>
          </div>
        ) : (
          questions.map((q) => (
            <div 
              key={q.id}
              onClick={() => setViewingQuestion(q)}
              className={cn(
                "bg-white p-5 rounded-3xl border transition-all cursor-pointer group relative",
                selectedIds.includes(q.id!) ? "border-blue-600 ring-2 ring-blue-50" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="flex items-start gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleSelect(q.id!); }}
                  className={cn(
                    "mt-1 w-5 h-5 border-2 rounded flex items-center justify-center transition-colors shrink-0",
                    selectedIds.includes(q.id!) ? "bg-blue-600 border-blue-600" : "border-slate-300"
                  )}
                >
                  {selectedIds.includes(q.id!) && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-wider">
                      {q.knowledgePoint}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium line-clamp-2 text-sm leading-relaxed">
                    {q.originalQuestion}
                  </p>
                </div>
                <button 
                  onClick={(e) => deleteQuestion(q.id!, e)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Add Modal */}
      <AnimatePresence>
        {isAddingManual && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <h3 className="text-xl font-bold text-slate-900">手动添加错题</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">题目内容</label>
                  <textarea 
                    value={manualQuestion.text}
                    onChange={(e) => setManualQuestion({...manualQuestion, text: e.target.value})}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                    placeholder="请输入题目内容..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">知识点</label>
                  <input 
                    value={manualQuestion.knowledgePoint}
                    onChange={(e) => setManualQuestion({...manualQuestion, knowledgePoint: e.target.value})}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例如：加减法"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">正确答案</label>
                  <input 
                    value={manualQuestion.correctAnswer}
                    onChange={(e) => setManualQuestion({...manualQuestion, correctAnswer: e.target.value})}
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="请输入答案..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsAddingManual(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleManualSave}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {viewingQuestion && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingQuestion(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-2xl bg-white rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
                <h3 className="font-bold text-slate-900">错题详情</h3>
                <button 
                  onClick={() => setViewingQuestion(null)}
                  className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-8">
                {/* Image Preview if exists */}
                {viewingQuestion.imageUrl && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                      <h4 className="font-bold text-slate-900">错题原图</h4>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                      <img 
                        src={viewingQuestion.imageUrl} 
                        className="w-full h-auto max-h-[500px] object-contain mx-auto" 
                        alt="Original Wrong Question" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </section>
                )}

                {/* Original */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                    <h4 className="font-bold text-slate-900">原题回顾</h4>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                    <p className="text-slate-700 leading-relaxed">{viewingQuestion.originalQuestion}</p>
                    {viewingQuestion.options && viewingQuestion.options.length > 0 && (
                      <div className="grid grid-cols-1 gap-2">
                        {viewingQuestion.options.map((opt, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600">
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-6 pt-2">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">你的答案</p>
                        <p className="text-sm font-bold text-slate-700">{viewingQuestion.userAnswer || '无'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">标准答案</p>
                        <p className="text-sm font-bold text-blue-600">{viewingQuestion.correctAnswer || '无'}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Variations */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                    <h4 className="font-bold text-slate-900">举一反三</h4>
                  </div>
                  <div className="space-y-4">
                    {viewingQuestion.variations.map((v, i) => (
                      <VariationCardDetail key={i} v={v} index={i} />
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Print Content */}
      <div className="fixed left-[-9999px] top-0">
        <div ref={printRef} className="w-[210mm] bg-white p-[20mm] space-y-12 text-black">
          <div className="border-b-2 border-black pb-4 mb-8">
            <h1 className="text-3xl font-bold">错题举一反三练习册</h1>
            <p className="text-sm text-gray-500 mt-2">生成时间：{new Date().toLocaleString()}</p>
          </div>
          {questions.filter(q => selectedIds.includes(q.id!)).map((q, idx) => (
            <div key={q.id} className="space-y-8 break-inside-avoid">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">题目 {idx + 1}</h2>
                <span className="text-sm font-bold border border-black px-3 py-1 rounded">
                  知识点：{q.knowledgePoint}
                </span>
              </div>
              
              {q.imageUrl && (
                <div className="space-y-4">
                  <p className="font-bold underline decoration-gray-300 underline-offset-4">【错题原图】</p>
                  <div className="max-w-full overflow-hidden rounded border border-gray-200">
                    <img src={q.imageUrl} className="max-w-full h-auto max-h-[100mm] mx-auto" alt="Original" referrerPolicy="no-referrer" />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <p className="font-bold underline decoration-gray-300 underline-offset-4">【原错题】</p>
                <div className="pl-4 border-l-2 border-gray-100 italic text-gray-700">
                  {q.originalQuestion}
                </div>
              </div>

              <div className="space-y-6">
                <p className="font-bold underline decoration-gray-300 underline-offset-4">【举一反三变式练习】</p>
                {q.variations.map((v, vIdx) => (
                  <div key={vIdx} className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">变式 {vIdx + 1}（{v.difficulty}）：</p>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{v.question}</ReactMarkdown>
                    </div>
                    <div className="mt-4 p-4 bg-amber-50 rounded border border-amber-100">
                      <p className="text-xs font-bold text-amber-600 mb-1">思路引导：</p>
                      <div className="text-xs text-amber-800 whitespace-pre-wrap">
                        <ReactMarkdown>{v.explanation}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs font-bold text-gray-500 mb-2">解题步骤：</p>
                      <div className="space-y-1 mb-3">
                        {v.steps.map((step, sIdx) => (
                          <div key={sIdx} className="flex gap-2 text-xs text-gray-700">
                            <span className="font-bold">{sIdx + 1}.</span>
                            <div className="whitespace-pre-wrap">
                              <ReactMarkdown>{step}</ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm font-bold mb-2">最终答案：{v.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
              {idx < selectedIds.length - 1 && <div className="border-b border-dashed border-gray-300 pt-8" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
