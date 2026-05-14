import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { CheckCircle2, Circle, Clock, Printer, UserCircle, Edit3, Lock, Calendar, Info, CalendarDays, List, Plus, Trash2, AlertCircle } from 'lucide-react';

// ==========================================
// ⚠️ 請將以下 firebaseConfig 替換成您自己的金鑰！
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCcseEW-WBREPFz068COJMHTy_v13qyoII",
  authDomain: "dailyworkjournalscr0.firebaseapp.com",
  projectId: "dailyworkjournalscr0",
  storageBucket: "dailyworkjournalscr0.firebasestorage.app",
  messagingSenderId: "1040290667108",
  appId: "1:1040290667108:web:df43f8e844cedad93e9d71",
  measurementId: "G-T5XH90SEWP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Task Configuration based on CSV ---
const taskConfig = [
  { id: 'morning_open', time: '早上', title: '辦公室開門', desc: '將門長開 (卡長放直到逼兩聲)' },
  { id: 'morning_clean', time: '早上', title: '環境整潔 (掃地.擦桌.拖地.拉窗簾.澆花.洗水槽)', desc: '*副校長在時不打擾，等副校長外出時補整理。\n*適時檢查水壺有沒有水、咖啡喝完杯子清洗。\n*一個禮拜至少換一次水槽網。\n*視情況清洗水槽、拖地。' },
  { id: 'morning_coffee', time: '早上', title: '準備咖啡 (馬克杯/保溫瓶)', desc: '水量: Extra Long Coffee / 濃度: Standard Coffee。\n*馬克杯 : 2杯+1杯+一些熱水\n*開會保溫瓶 : 2杯+一些點熱水' },
  { id: 'morning_tea', time: '早上', title: '準備茶一壺', desc: '茶包袋 (1.5-2匙)茶葉。\n*杯杯、茶壺、保溫瓶都需用洗碗精清洗。' },
  { id: 'morning_lunch', time: '早上', title: '買楊副午餐', desc: '約11:00時，詢問秘書需不需要幫副校長買午餐。' },
  { id: 'afternoon_trash', time: '下午', title: '收垃圾與水槽清理', desc: '收垃圾並倒至茶水間公用垃圾桶。\n*倒垃圾時一併將水槽網的渣渣倒掉。' },
  { id: 'afternoon_wash', time: '下午', title: '茶具清洗與下班整理', desc: '*若後續沒訪客，下班前把茶水倒掉及洗茶壺。' },
  { id: 'anytime_mail', time: '下午', title: '郵件收發', desc: '收發室收郵務。' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('assistant');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('daily');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [allLogs, setAllLogs] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [newCustomTaskText, setNewCustomTaskText] = useState('');

  // 密碼驗證狀態
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const SUPERVISOR_PASSWORD = 'wntest'; // ★ 主管密碼在此修改

  const logData = allLogs[selectedDate] || { tasks: {}, supervisorFeedback: '', assistantNotes: '', customTasks: [] };

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    // 正式環境我們將資料存在根目錄的 assistant_logs 集合中
    const colRef = collection(db, 'assistant_logs');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const logs = {};
      snapshot.forEach((doc) => { logs[doc.id] = doc.data(); });
      setAllLogs(logs);
    });
    return () => unsubscribe();
  }, [user]);

  const updateDocData = async (newData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'assistant_logs', selectedDate);
      await setDoc(docRef, { ...logData, ...newData, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTask = (taskId) => {
    if (role === 'supervisor') return; 
    updateDocData({ tasks: { ...logData.tasks, [taskId]: !logData.tasks[taskId] } });
  };

  const handleSupervisorClick = () => {
    if (role === 'supervisor') return;
    setShowPasswordPrompt(true);
  };

  const verifyPassword = () => {
    if (passwordInput === SUPERVISOR_PASSWORD) {
      setRole('supervisor');
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('密碼錯誤，請重新輸入');
    }
  };

  const handleAddCustomTask = () => {
    if (!newCustomTaskText.trim() || role !== 'supervisor') return;
    const newTask = { id: `custom_${Date.now()}`, title: newCustomTaskText.trim(), completed: false };
    updateDocData({ customTasks: [...(logData.customTasks || []), newTask] });
    setNewCustomTaskText('');
  };

  const handleToggleCustomTask = (taskId) => {
    if (role === 'supervisor') return;
    updateDocData({ customTasks: (logData.customTasks || []).map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) });
  };

  const handleRemoveCustomTask = (taskId) => {
    if (role !== 'supervisor') return;
    updateDocData({ customTasks: (logData.customTasks || []).filter(t => t.id !== taskId) });
  };

  const customTasksList = logData.customTasks || [];
  const completedRegularTasks = Object.values(logData.tasks || {}).filter(Boolean).length;
  const completedCustomTasks = customTasksList.filter(t => t.completed).length;
  const totalCompletedTasks = completedRegularTasks + completedCustomTasks;
  const totalTasksCount = taskConfig.length + customTasksList.length;
  const progressPercent = totalTasksCount > 0 ? Math.round((totalCompletedTasks / totalTasksCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans print:bg-white print:p-0">
      {/* Top Navigation */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg"><Clock className="w-5 h-5 text-white" /></div>
            <h1 className="text-xl font-bold text-slate-800">楊副校長室 - 專任助理工作日誌</h1>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('daily')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><Calendar className="w-4 h-4" />日誌</button>
              <button onClick={() => setViewMode('monthly')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><List className="w-4 h-4" />月報表</button>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setRole('assistant')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${role === 'assistant' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}><UserCircle className="w-4 h-4" />我是助理</button>
              <button onClick={handleSupervisorClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${role === 'supervisor' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}><Lock className="w-4 h-4" />主管/同仁</button>
            </div>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"><Printer className="w-4 h-4" /><span className="hidden sm:inline">列印 / 匯出PDF</span></button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 print:py-0">
        {viewMode === 'monthly' ? (
          <div className="space-y-6">
            <div className="hidden print:block text-center mb-8 border-b-2 border-slate-800 pb-4">
              <h1 className="text-2xl font-bold text-black mb-2">楊副校長室 專任助理工作月報表</h1>
              <p className="text-lg text-slate-600">紀錄月份：{selectedMonth.split('-')[0]} 年 {selectedMonth.split('-')[1]} 月</p>
            </div>
            <div className="flex justify-between items-end print:hidden mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1"><CalendarDays className="w-4 h-4" />選擇月份</label>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm outline-none" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-sm print:text-[13px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 print:bg-white print:border-b-2 print:border-slate-800">
                    <tr><th className="px-4 py-3 font-semibold w-24">日期</th><th className="px-4 py-3 font-semibold w-24">完成度</th><th className="px-4 py-3 font-semibold w-1/3">助理備註</th><th className="px-4 py-3 font-semibold w-1/3">主管提醒事項</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                    {Array.from({ length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate() }, (_, i) => {
                      const dateStr = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
                      const dayData = allLogs[dateStr] || {};
                      const dayCustomTasks = dayData.customTasks || [];
                      const completed = Object.values(dayData.tasks || {}).filter(Boolean).length + dayCustomTasks.filter(t => t.completed).length;
                      const total = taskConfig.length + dayCustomTasks.length;
                      return (
                        <tr key={dateStr} className={`${dateStr === new Date().toISOString().split('T')[0] ? 'bg-blue-50/40' : ''} ${completed > 0 && completed < total ? 'bg-red-50/60' : ''} ${!!dayData.supervisorFeedback ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{dateStr.split('-').slice(1).join('/')}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${completed === total && total > 0 ? 'bg-emerald-100 text-emerald-700' : completed > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{completed} / {total}</span></td>
                          <td className="px-4 py-3 text-slate-600 whitespace-pre-wrap">{dayData.assistantNotes || '-'}</td>
                          <td className={`px-4 py-3 whitespace-pre-wrap ${!!dayData.supervisorFeedback ? 'text-amber-700 font-medium print:text-black' : 'text-slate-600'}`}>{dayData.supervisorFeedback || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="hidden print:flex justify-end mt-12 gap-16 pr-8">
              <div className="text-center"><div className="w-40 border-b border-black mb-2"></div><span className="text-slate-600">專任助理簽名</span></div>
              <div className="text-center"><div className="w-40 border-b border-black mb-2"></div><span className="text-slate-600">主管/檢核人簽名</span></div>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden print:block text-center mb-8 border-b-2 border-slate-800 pb-4">
              <h1 className="text-2xl font-bold text-black mb-2">楊副校長室 專任助理工作日誌</h1>
              <p className="text-lg text-slate-600">紀錄日期：{selectedDate}</p>
            </div>
            <div className="flex justify-between items-end mb-8 gap-4 print:hidden">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1"><Calendar className="w-4 h-4" />選擇日期</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none" />
              </div>
              <div className="bg-white px-4 py-3 rounded-xl border border-slate-100 flex-1 max-w-[250px]">
                <div className="flex justify-between text-sm mb-1"><span className="font-medium text-slate-600">今日完成度</span><span className="font-bold text-blue-600">{progressPercent}%</span></div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${progressPercent}%` }}></div></div>
              </div>
            </div>

            {role === 'assistant' && (
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 mb-6 print:hidden">
                <Info className="w-5 h-5 mt-0.5 shrink-0" /><p className="text-sm">請確實核對並勾選完成的工作項目。最下方的主管提醒事項僅供檢視。</p>
              </div>
            )}

            <div className="space-y-6">
              {['早上', '下午', '不定時'].map((timeGroup) => {
                const groupTasks = taskConfig.filter(t => t.time === timeGroup);
                if (groupTasks.length === 0) return null;
                return (
                  <div key={timeGroup} className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-slate-300 print:mb-4">
                    <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2 print:bg-slate-100"><Clock className="w-4 h-4" /><h2 className="font-semibold text-slate-700">{timeGroup}任務</h2></div>
                    <div className="divide-y divide-slate-100">
                      {groupTasks.map((task) => {
                        const isCompleted = logData.tasks?.[task.id] || false;
                        return (
                          <div key={task.id} className="p-5 print:p-3 flex items-start gap-4 hover:bg-slate-50">
                            <button onClick={() => toggleTask(task.id)} disabled={role === 'supervisor'} className={`mt-1 ${role === 'supervisor' ? 'opacity-50' : ''}`}>
                              {isCompleted ? <CheckCircle2 className="w-6 h-6 text-emerald-500 print:text-black" /> : <Circle className="w-6 h-6 text-slate-300 hover:text-blue-400 print:text-slate-400" />}
                            </button>
                            <div>
                              <h3 className={`font-medium mb-1 ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</h3>
                              <p className="text-sm text-slate-500 whitespace-pre-wrap">{task.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* 臨時交辦事項 */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-slate-300">
                <div className="bg-indigo-50 px-5 py-3 border-b flex items-center gap-2 print:bg-slate-100">
                  <AlertCircle className="w-4 h-4 text-indigo-500" /><h2 className="font-semibold text-indigo-700">臨時交辦事項</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {customTasksList.map((task) => (
                    <div key={task.id} className="p-5 flex items-start gap-4">
                      <button onClick={() => handleToggleCustomTask(task.id)} disabled={role === 'supervisor'} className={`mt-1 ${role === 'supervisor' ? 'opacity-50' : ''}`}>
                        {task.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-slate-300" />}
                      </button>
                      <h3 className={`flex-1 mt-1 font-medium ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</h3>
                      {role === 'supervisor' && <button onClick={() => handleRemoveCustomTask(task.id)} className="p-2 text-slate-300 hover:text-red-500 print:hidden"><Trash2 className="w-5 h-5" /></button>}
                    </div>
                  ))}
                  {role === 'supervisor' && (
                    <div className="p-5 bg-slate-50 flex gap-3 print:hidden">
                      <input type="text" value={newCustomTaskText} onChange={(e) => setNewCustomTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTask()} placeholder="輸入臨時交辦事項..." className="flex-1 px-4 py-2 border rounded-lg outline-none" />
                      <button onClick={handleAddCustomTask} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-1"><Plus className="w-4 h-4" />新增</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="bg-white rounded-xl border flex flex-col">
                <div className="bg-slate-50 px-5 py-3 border-b flex items-center gap-2"><Edit3 className="w-4 h-4" /><h2 className="font-semibold text-slate-700">助理備註</h2></div>
                <textarea key={selectedDate} className="p-5 w-full h-40 resize-none outline-none text-sm" placeholder="無備註" defaultValue={logData.assistantNotes || ''} onBlur={(e) => updateDocData({ assistantNotes: e.target.value })} disabled={role === 'supervisor'} />
              </div>
              <div className={`rounded-xl border flex flex-col ${role === 'supervisor' ? 'border-amber-200' : 'border-slate-200'}`}>
                <div className={`px-5 py-3 border-b flex items-center justify-between ${role === 'supervisor' ? 'bg-amber-50' : 'bg-slate-100'}`}>
                  <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-amber-600" /><h2 className="font-semibold text-amber-800">主管/同仁 提醒與改進事項</h2></div>
                </div>
                <textarea key={selectedDate} className="p-5 w-full h-40 resize-none outline-none text-sm" placeholder={role === 'supervisor' ? "輸入提醒事項..." : "無提醒事項"} defaultValue={logData.supervisorFeedback || ''} onBlur={(e) => updateDocData({ supervisorFeedback: e.target.value })} disabled={role === 'assistant'} />
              </div>
            </div>
          </>
        )}
        <div className={`fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-full text-sm print:hidden ${isSaving ? 'opacity-100' : 'opacity-0'}`}>儲存中...</div>
      </main>

      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-amber-600"/> 請輸入主管密碼</h3>
            <input type="password" value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }} className="w-full px-4 py-3 border rounded-xl mb-1 outline-none" placeholder="預設密碼為: admin" onKeyDown={(e) => e.key === 'Enter' && verifyPassword()} autoFocus />
            <p className="text-red-500 text-sm mb-4 h-5">{passwordError}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowPasswordPrompt(false); setPasswordInput(''); setPasswordError(''); }} className="px-4 py-2 bg-slate-100 rounded-xl">取消</button>
              <button onClick={verifyPassword} className="px-4 py-2 bg-amber-600 text-white rounded-xl">解鎖</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
