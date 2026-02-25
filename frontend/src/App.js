import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import "@/App.css";
import axios from "axios";
import { 
  Calendar, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  Mic, 
  MicOff, 
  Send, 
  Zap, 
  ChevronLeft, 
  ChevronRight,
  Home,
  ListTodo,
  Bot,
  Play,
  Sun,
  Moon,
  Clock,
  LogOut,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Volume2,
  Bell,
  BellRing,
  GripVertical,
  Languages
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { translations } from "./i18n/translations";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

// ==================== CONTEXT ====================
const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'en';
  });

  const t = useCallback((key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  }, [language]);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'fr' : 'en';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// ==================== UTILITY FUNCTIONS ====================
const formatDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (dateKey, t) => {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateKey === formatDateKey(today)) return t('today');
  if (dateKey === formatDateKey(yesterday)) return t('yesterday');
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTime = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// ==================== NOTIFICATION HELPERS ====================
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

const showNotification = (title, body, tag = 'task-reminder') => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag,
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    return notification;
  }
};

// ==================== THEME HOOK ====================
const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme };
};

// ==================== LIVE CLOCK COMPONENT ====================
const LiveClock = ({ className = "" }) => {
  const [time, setTime] = useState(new Date());
  const { language } = useLanguage();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`clock-display ${className}`}>
      <div className="text-3xl md:text-4xl font-bold">
        {time.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: language !== 'fr' })}
      </div>
      <div className="text-sm text-muted-foreground">
        {time.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
};

// ==================== LANGUAGE TOGGLE ====================
const LanguageToggle = ({ className = "" }) => {
  const { language, toggleLanguage } = useLanguage();
  
  return (
    <button
      onClick={toggleLanguage}
      className={`p-2 rounded-xl hover:bg-muted transition-colors flex items-center gap-1 ${className}`}
      data-testid="language-toggle"
      title={language === 'en' ? 'Switch to French' : 'Passer en anglais'}
    >
      <Languages className="w-5 h-5" />
      <span className="text-xs font-bold">{language.toUpperCase()}</span>
    </button>
  );
};

// ==================== AUTH COMPONENTS ====================
const AuthPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const { theme, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await axios.post(`${API}${endpoint}`, formData);
      toast.success(isLogin ? t('welcomeBack') : t('accountCreated'));
      onLogin(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <LanguageToggle />
        <button onClick={toggleTheme} className="p-3 rounded-full glass hover:bg-muted transition-colors" data-testid="theme-toggle-auth">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-flow flex items-center justify-center mx-auto mb-4 animate-neon-glow">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">FlowTask Pro</span>
          </h1>
          <p className="text-muted-foreground">{language === 'fr' ? 'Gestion de tâches intelligente' : 'AI-powered task management'}</p>
        </div>

        <div className="glass rounded-2xl p-6 neon-border">
          <div className="flex mb-6">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 text-sm font-medium rounded-l-xl transition-all ${isLogin ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-testid="login-tab">
              {t('signIn')}
            </button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 text-sm font-medium rounded-r-xl transition-all ${!isLogin ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-testid="register-tab">
              {t('signUp')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{t('fullName')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input data-testid="name-input" type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="John Doe" required={!isLogin} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input data-testid="email-input" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="you@example.com" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input data-testid="password-input" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} className="w-full pl-10 pr-12 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="••••••••" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 gradient-flow text-white rounded-xl font-semibold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95 disabled:opacity-50" data-testid="submit-auth-btn">
              {loading ? t('loading') : (isLogin ? t('signIn') : t('createAccount'))}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span></div>
          </div>

          <button onClick={handleGoogleLogin} className="w-full py-3 border border-border rounded-xl font-medium hover:bg-muted transition-all flex items-center justify-center gap-2" data-testid="google-login-btn">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('continueWithGoogle')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Auth Callback
const AuthCallback = ({ onLogin }) => {
  const hasProcessed = useRef(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = window.location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        try {
          const response = await axios.post(`${API}/auth/google/session`, { session_id: sessionId });
          toast.success(t('welcomeBack'));
          onLogin(response.data);
          window.history.replaceState(null, '', window.location.pathname);
        } catch (error) {
          toast.error('Authentication failed');
          window.location.href = '/';
        }
      } else {
        window.location.href = '/';
      }
    };

    processAuth();
  }, [onLogin, t]);

  const { t: translate } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">{translate('authenticating')}</p>
      </div>
    </div>
  );
};

// ==================== PRIORITY BADGE ====================
const PriorityBadge = ({ priority, t }) => {
  const colors = {
    high: 'bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
    low: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
  };
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[priority] || colors.medium}`}>
      {t(priority)}
    </span>
  );
};

// ==================== TASK CARD WITH DRAG ====================
const TaskCard = ({ task, onToggle, onEdit, onDelete, showDate = false, isDragging = false, dragHandleProps = {} }) => {
  const { t } = useLanguage();
  
  return (
    <div 
      data-testid={`task-card-${task.id}`}
      className={`glass rounded-xl p-4 border border-border/50 transition-all duration-300 hover:border-primary/30 group ${task.completed ? 'opacity-60' : ''} ${isDragging ? 'shadow-2xl scale-105 z-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing touch-target p-1 -ml-1 text-muted-foreground hover:text-foreground">
          <GripVertical className="w-4 h-4" />
        </div>
        
        <button
          data-testid={`toggle-task-${task.id}`}
          onClick={() => onToggle(task.id, !task.completed)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all touch-target ${
            task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/50 hover:border-primary'
          }`}
        >
          {task.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.text}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {showDate && (
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                {formatDisplayDate(task.date, t)}
              </span>
            )}
            {task.time && (
              <span className="text-xs text-primary flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(task.time)}
              </span>
            )}
            {task.reminder && task.reminder !== 'none' && (
              <span className="text-xs text-accent flex items-center gap-1">
                <Bell className="w-3 h-3" />
                {t(task.reminder === '15min' ? 'mins15Before' : task.reminder === '30min' ? 'mins30Before' : task.reminder === '1hour' ? 'hour1Before' : 'atTaskTime')}
              </span>
            )}
            {task.audio_base64 && (
              <button onClick={() => { const audio = new Audio(task.audio_base64); audio.play(); }} className="text-xs text-secondary hover:text-secondary/80 flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> {t('voice')}
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <PriorityBadge priority={task.priority} t={t} />
          <button data-testid={`edit-task-${task.id}`} onClick={() => onEdit(task)} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors opacity-0 group-hover:opacity-100 touch-target">
            <Edit3 className="w-4 h-4" />
          </button>
          <button data-testid={`delete-task-${task.id}`} onClick={() => onDelete(task.id)} className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors opacity-0 group-hover:opacity-100 touch-target">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== DASHBOARD SECTION ====================
const DashboardSection = ({ tasks, selectedDate, setSelectedDate, onToggleTask, onEditTask, onDeleteTask, onQuickAdd, stats, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [quickTaskText, setQuickTaskText] = useState('');
  const [quickTaskTime, setQuickTaskTime] = useState('');
  const { t, language } = useLanguage();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  
  const dayTasks = tasks.filter(task => task.date === formatDateKey(selectedDate));
  const completedCount = dayTasks.filter(task => task.completed).length;
  const progress = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;
  
  const monthNames = language === 'fr' ? MONTHS_FR : MONTHS;
  
  const handleQuickAdd = () => {
    if (!quickTaskText.trim()) return;
    onQuickAdd(quickTaskText, formatDateKey(selectedDate), quickTaskTime || null);
    setQuickTaskText('');
    setQuickTaskTime('');
  };
  
  const changeMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };
  
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  return (
    <div className="animate-slide-up">
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                {t('hello')}, {user?.name?.split(' ')[0] || 'there'}
              </span>
            </h1>
            <p className="text-muted-foreground text-lg">
              {language === 'fr' ? `Vous avez ${stats?.pending || 0} tâches en attente` : `You have ${stats?.pending || 0} tasks pending`}
            </p>
          </div>
          <div className="glass rounded-2xl p-4 neon-border text-center md:text-right">
            <LiveClock />
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          {/* Calendar */}
          <div className="glass rounded-2xl p-6 neon-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {monthNames[month]} {year}
              </h2>
              <div className="flex gap-1">
                <button data-testid="prev-month-btn" onClick={() => changeMonth(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors touch-target">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button data-testid="next-month-btn" onClick={() => changeMonth(1)} className="p-2 hover:bg-muted rounded-lg transition-colors touch-target">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {(language === 'fr' ? ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map(day => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-1">{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="h-10" />;
                
                const dateKey = formatDateKey(new Date(year, month, day));
                const dayTaskList = tasks.filter(task => task.date === dateKey);
                const dayCompleted = dayTaskList.filter(task => task.completed).length;
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
                
                return (
                  <button
                    key={day}
                    data-testid={`calendar-day-${day}`}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`h-10 rounded-lg flex flex-col items-center justify-center cursor-pointer relative transition-all touch-target ${
                      isToday ? 'gradient-flow text-white font-bold' : 
                      isSelected ? 'bg-primary/20 border border-primary text-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="text-sm font-medium">{day}</span>
                    {dayTaskList.length > 0 && (
                      <div className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                        dayCompleted === dayTaskList.length ? 'bg-emerald-500' : dayCompleted > 0 ? 'bg-primary' : 'bg-amber-500'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('selected')}</p>
                  <p className="text-lg font-semibold">{formatDateKey(selectedDate) === formatDateKey(today) ? t('today') : selectedDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('progress')}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full gradient-flow rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-sm font-bold text-primary">{progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Add */}
          <div className="glass rounded-2xl p-6 neon-border">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <Plus className="w-4 h-4 text-emerald-500" />
              {t('quickAdd')}
            </h3>
            <div className="space-y-3">
              <input data-testid="quick-add-input" type="text" value={quickTaskText} onChange={(e) => setQuickTaskText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleQuickAdd()} placeholder={t('whatNeedsToBeDone')} className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input data-testid="quick-add-time" type="time" value={quickTaskTime} onChange={(e) => setQuickTaskTime(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" />
                </div>
                <button data-testid="quick-add-btn" onClick={handleQuickAdd} className="px-6 py-2 gradient-flow text-white rounded-xl font-medium transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-7 space-y-6">
          {/* Daily Flow */}
          <div className="glass rounded-2xl p-6 neon-border min-h-[160px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                {t('dailyFlow')}
              </h3>
              <span className="text-xs px-3 py-1 bg-primary/20 text-primary rounded-full">{dayTasks.length} {language === 'fr' ? 'tâches' : 'tasks'}</span>
            </div>
            
            <div className="flex items-center gap-4 overflow-x-auto pb-4 px-1 min-h-[100px] snap-x">
              {dayTasks.length === 0 ? (
                <div className="text-muted-foreground text-center w-full py-8 text-sm">{t('noTasksFlow')}</div>
              ) : (
                dayTasks.map((task, index) => (
                  <div key={task.id} className="flex-shrink-0 relative snap-start animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-all hover:scale-110 ${task.completed ? 'gradient-success' : 'gradient-flow'}`}>
                      {task.completed ? <CheckCircle2 className="w-8 h-8 text-white" /> : (
                        <>
                          <span className="text-xl font-bold text-white">{index + 1}</span>
                          {task.time && <span className="text-[10px] text-white/80">{formatTime(task.time)}</span>}
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium text-muted-foreground truncate w-16 md:w-20 text-center">{task.text}</p>
                    {index < dayTasks.length - 1 && <div className="absolute top-8 -right-3 w-6 h-0.5 bg-gradient-to-r from-primary to-accent hidden md:block" />}
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Task List */}
          <div className="space-y-3">
            {dayTasks.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <ListTodo className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">{t('noTasksForDay')}</p>
                <p className="text-muted-foreground/60 text-xs mt-1">{t('addOneToStart')}</p>
              </div>
            ) : (
              dayTasks.map((task, index) => (
                <div key={task.id} className="animate-slide-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <TaskCard task={task} onToggle={onToggleTask} onEdit={onEditTask} onDelete={onDeleteTask} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== TASK MANAGER SECTION ====================
const TaskManagerSection = ({ tasks, onCreateTask, onUpdateTask, onDeleteTask, onToggleTask, onReorderTasks }) => {
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({ text: '', date: formatDateKey(new Date()), time: '', priority: 'medium', reminder: 'none', audio_base64: null });
  const [isRecording, setIsRecording] = useState(false);
  const [filterDate, setFilterDate] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [draggedTask, setDraggedTask] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const { t, language } = useLanguage();
  
  const uniqueDates = [...new Set(tasks.map(task => task.date))].sort();
  
  let filteredTasks = [...tasks];
  if (filterDate !== 'all') filteredTasks = filteredTasks.filter(task => task.date === filterDate);
  if (filterPriority !== 'all') filteredTasks = filteredTasks.filter(task => task.priority === filterPriority);
  
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  filteredTasks.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.order !== b.order) return a.order - b.order;
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.text.trim() || !formData.date) {
      toast.error(language === 'fr' ? 'Veuillez remplir tous les champs requis' : 'Please fill in all required fields');
      return;
    }
    
    const taskData = { ...formData, time: formData.time || null, reminder: formData.reminder || 'none' };
    
    if (editingTask) {
      await onUpdateTask(editingTask.id, taskData);
      toast.success(t('taskUpdated'));
    } else {
      await onCreateTask(taskData);
      toast.success(t('taskCreated'));
    }
    
    resetForm();
  };
  
  const resetForm = () => {
    setFormData({ text: '', date: formatDateKey(new Date()), time: '', priority: 'medium', reminder: 'none', audio_base64: null });
    setEditingTask(null);
  };
  
  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({ text: task.text, date: task.date, time: task.time || '', priority: task.priority, reminder: task.reminder || 'none', audio_base64: task.audio_base64 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => setFormData(prev => ({ ...prev, audio_base64: reader.result }));
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start(1000);
        setIsRecording(true);
        toast.info(language === 'fr' ? 'Enregistrement démarré...' : 'Recording started...');
      } catch (err) {
        toast.error(language === 'fr' ? 'Accès au microphone refusé' : 'Microphone access denied');
      }
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      toast.success(language === 'fr' ? 'Enregistrement sauvegardé !' : 'Recording saved!');
    }
  };
  
  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = async (e, targetTask) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.id === targetTask.id) return;
    
    const newTasks = [...filteredTasks];
    const dragIndex = newTasks.findIndex(task => task.id === draggedTask.id);
    const dropIndex = newTasks.findIndex(task => task.id === targetTask.id);
    
    newTasks.splice(dragIndex, 1);
    newTasks.splice(dropIndex, 0, draggedTask);
    
    const taskOrders = newTasks.map((task, index) => ({ id: task.id, order: index }));
    await onReorderTasks(taskOrders);
    
    setDraggedTask(null);
  };

  return (
    <div className="animate-slide-up">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">{t('taskManager')}</span>
        </h1>
        <p className="text-muted-foreground">{language === 'fr' ? 'Contrôle total sur vos tâches' : 'Full control over your tasks'}</p>
      </header>
      
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 neon-border sticky top-24">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {editingTask ? <Edit3 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-emerald-500" />}
              {editingTask ? t('editTask') : t('newTask')}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('taskName')}</label>
                <input data-testid="task-name-input" type="text" value={formData.text} onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder={t('enterTaskDescription')} required />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('date')}</label>
                  <input data-testid="task-date-input" type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('time')}</label>
                  <input data-testid="task-time-input" type="time" value={formData.time} onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('priority')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['low', 'medium', 'high'].map((priority) => (
                    <button key={priority} type="button" data-testid={`priority-${priority}`} onClick={() => setFormData(prev => ({ ...prev, priority }))} className={`py-2 rounded-lg border-2 text-sm font-medium transition-all touch-target ${formData.priority === priority ? priority === 'high' ? 'border-red-500 bg-red-500/20 text-red-500 dark:text-red-400' : priority === 'medium' ? 'border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'border-border hover:border-muted-foreground'}`}>
                      {t(priority)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Reminder */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  {t('reminder')}
                </label>
                <select data-testid="task-reminder" value={formData.reminder} onChange={(e) => setFormData(prev => ({ ...prev, reminder: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                  <option value="none">{t('noReminder')}</option>
                  <option value="15min">{t('mins15Before')}</option>
                  <option value="30min">{t('mins30Before')}</option>
                  <option value="1hour">{t('hour1Before')}</option>
                  <option value="attime">{t('atTaskTime')}</option>
                </select>
              </div>
              
              {/* Voice Recording */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('voiceNote')}</label>
                <div className="flex items-center gap-3">
                  <button type="button" data-testid="record-btn" onClick={toggleRecording} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md touch-target ${isRecording ? 'gradient-danger animate-pulse-ring' : 'bg-red-500 hover:bg-red-600'}`}>
                    {isRecording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                  </button>
                  <div className="flex-1">
                    {isRecording && <span className="text-sm text-red-500">{t('recordingTapToStop')}</span>}
                    {formData.audio_base64 && !isRecording && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { const audio = new Audio(formData.audio_base64); audio.play(); }} className="text-sm text-primary hover:text-primary/80 flex items-center gap-1">
                          <Play className="w-4 h-4" /> {t('playRecording')}
                        </button>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, audio_base64: null }))} className="text-xs text-red-500 hover:text-red-400">{t('remove')}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 py-3 border border-border text-foreground rounded-xl hover:bg-muted transition-all font-medium text-sm">{t('reset')}</button>
                <button type="submit" data-testid="submit-task-btn" className="flex-1 py-3 gradient-flow text-white rounded-xl font-semibold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95">{editingTask ? t('update') : t('create')}</button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="lg:col-span-2">
          <div className="glass rounded-2xl p-6 neon-border min-h-[600px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-semibold">{t('allTasks')}</h3>
              <div className="flex gap-2">
                <select data-testid="filter-date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm focus:border-primary outline-none">
                  <option value="all">{t('allDates')}</option>
                  {uniqueDates.map(date => <option key={date} value={date}>{formatDisplayDate(date, t)}</option>)}
                </select>
                <select data-testid="filter-priority" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm focus:border-primary outline-none">
                  <option value="all">{t('allPriorities')}</option>
                  <option value="high">{t('high')}</option>
                  <option value="medium">{t('medium')}</option>
                  <option value="low">{t('low')}</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{t('noTasksFound')}</p>
                </div>
              ) : (
                filteredTasks.map((task, index) => (
                  <div key={task.id} className={`animate-slide-in ${draggedTask?.id === task.id ? 'opacity-50' : ''}`} style={{ animationDelay: `${index * 0.03}s` }} draggable onDragStart={(e) => handleDragStart(e, task)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, task)}>
                    <TaskCard task={task} onToggle={onToggleTask} onEdit={handleEdit} onDelete={onDeleteTask} showDate={true} isDragging={draggedTask?.id === task.id} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== AI ASSISTANT SECTION ====================
const AIAssistantSection = ({ sessionId }) => {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'assistant', content: t('aiWelcome') }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  
  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const userMessage = { id: Date.now().toString(), role: 'user', content: inputText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/chat`, { session_id: sessionId, message: inputText });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(language === 'fr' ? 'Échec de la réponse IA' : 'Failed to get AI response');
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: language === 'fr' ? "Désolé, une erreur s'est produite. Veuillez réessayer." : "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const quickAsk = (question) => {
    setInputText(question);
    setTimeout(() => document.getElementById('ai-send-btn')?.click(), 100);
  };
  
  const clearChat = () => {
    setMessages([{ id: 'welcome-new', role: 'assistant', content: t('chatCleared') }]);
    axios.delete(`${API}/chat/history/${sessionId}`).catch(console.error);
  };

  return (
    <div className="animate-slide-up">
      <header className="mb-6 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">{t('aiAssistant')}</span>
        </h1>
        <p className="text-muted-foreground">{t('smartAnalysis')}</p>
      </header>
      
      <div className="max-w-3xl mx-auto">
        <div className="glass-strong rounded-2xl overflow-hidden flex flex-col h-[70vh] md:h-[600px] neon-border">
          <div className="gradient-flow p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm animate-float">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">FlowAI</h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <p className="text-white/70 text-xs">{t('poweredByGemini')}</p>
                </div>
              </div>
            </div>
            <button data-testid="clear-chat-btn" onClick={clearChat} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors touch-target">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
            {messages.map((message, index) => (
              <div key={message.id} className={`flex gap-3 animate-slide-in ${message.role === 'user' ? 'flex-row-reverse' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'assistant' ? 'gradient-flow' : 'bg-muted'}`}>
                  {message.role === 'assistant' ? <Zap className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className={`max-w-[80%] md:max-w-[70%] rounded-2xl p-4 ${message.role === 'assistant' ? 'glass rounded-tl-none' : 'bg-primary text-white rounded-tr-none'}`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 animate-slide-in">
                <div className="w-8 h-8 rounded-full gradient-flow flex items-center justify-center flex-shrink-0"><Zap className="w-5 h-5 text-white" /></div>
                <div className="glass rounded-2xl rounded-tl-none p-4"><div className="typing-indicator flex gap-1"><span /><span /><span /></div></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-4 bg-card border-t border-border/50 shrink-0">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {[t('prioritize'), t('weeklyStats'), t('pending'), t('planDay')].map((label, index) => {
                const questions = [
                  language === 'fr' ? 'Que dois-je prioriser aujourd\'hui ?' : 'What should I prioritize today?',
                  language === 'fr' ? 'Quelle est ma productivité cette semaine ?' : 'How productive am I this week?',
                  language === 'fr' ? 'Quelles tâches sont en attente ?' : 'What tasks are pending?',
                  language === 'fr' ? 'Aide-moi à planifier ma journée' : 'Help me plan my day'
                ];
                return (
                  <button key={index} onClick={() => quickAsk(questions[index])} className="px-3 py-1.5 bg-muted hover:bg-primary/10 hover:text-primary rounded-full text-xs text-muted-foreground whitespace-nowrap transition-colors border border-transparent hover:border-primary/30">
                    {label}
                  </button>
                );
              })}
            </div>
            
            <div className="flex gap-2">
              <input data-testid="ai-input" type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder={t('askAnything')} className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" disabled={isLoading} />
              <button id="ai-send-btn" data-testid="ai-send-btn" onClick={sendMessage} disabled={isLoading} className="px-6 py-3 gradient-flow text-white rounded-xl font-semibold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95 disabled:opacity-50 flex items-center gap-2">
                <span className="hidden sm:inline">{t('send')}</span>
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN APP COMPONENT ====================
function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');
  const { theme, toggleTheme } = useTheme();
  const { t, language, toggleLanguage } = useLanguage();
  
  const isAuthCallback = window.location.pathname === '/auth/callback' || window.location.hash?.includes('session_id=');
  
  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW registration failed:', err));
    }
  }, []);
  
  // Check reminders periodically
  useEffect(() => {
    if (!user || !notificationsEnabled) return;
    
    const checkReminders = async () => {
      try {
        const response = await axios.get(`${API}/tasks/reminders/pending`);
        const reminders = response.data.reminders || [];
        
        for (const reminder of reminders) {
          const title = reminder.is_due ? (language === 'fr' ? 'Tâche à faire !' : 'Task due now!') : (language === 'fr' ? 'Rappel de tâche' : 'Task Reminder');
          const body = reminder.is_due ? `${reminder.text}` : `${reminder.text} ${language === 'fr' ? 'dans 15 minutes' : 'in 15 minutes'}`;
          
          showNotification(title, body, `reminder-${reminder.id}`);
          await axios.post(`${API}/tasks/${reminder.id}/reminder-sent`);
        }
      } catch (error) {
        console.error('Error checking reminders:', error);
      }
    };
    
    checkReminders();
    const interval = setInterval(checkReminders, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [user, notificationsEnabled, language]);
  
  // Check existing session
  useEffect(() => {
    if (isAuthCallback) { setLoading(false); return; }
    
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [isAuthCallback]);
  
  const fetchTasks = useCallback(async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API}/tasks`);
      setTasks(response.data);
    } catch (error) { console.error('Error fetching tasks:', error); }
  }, [user]);
  
  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API}/tasks/stats/summary`);
      setStats(response.data);
    } catch (error) { console.error('Error fetching stats:', error); }
  }, [user]);
  
  useEffect(() => { if (user) { fetchTasks(); fetchStats(); } }, [user, fetchTasks, fetchStats]);
  
  const createTask = async (taskData) => {
    try {
      await axios.post(`${API}/tasks`, taskData);
      fetchTasks();
      fetchStats();
    } catch (error) { console.error('Error creating task:', error); toast.error(language === 'fr' ? 'Échec de création' : 'Failed to create task'); }
  };
  
  const updateTask = async (taskId, updates) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, updates);
      fetchTasks();
      fetchStats();
    } catch (error) { console.error('Error updating task:', error); toast.error(language === 'fr' ? 'Échec de mise à jour' : 'Failed to update task'); }
  };
  
  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      fetchTasks();
      fetchStats();
      toast.success(t('taskDeleted'));
    } catch (error) { console.error('Error deleting task:', error); toast.error(language === 'fr' ? 'Échec de suppression' : 'Failed to delete task'); }
  };
  
  const toggleTask = async (taskId, completed) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { completed });
      fetchTasks();
      fetchStats();
      if (completed) toast.success(t('taskCompleted'));
    } catch (error) { console.error('Error toggling task:', error); }
  };
  
  const quickAddTask = async (text, date, time) => {
    await createTask({ text, date, time, priority: 'medium' });
    toast.success(t('taskAdded'));
  };
  
  const reorderTasks = async (taskOrders) => {
    try {
      await axios.put(`${API}/tasks/reorder`, { task_orders: taskOrders });
      fetchTasks();
    } catch (error) { console.error('Error reordering tasks:', error); }
  };
  
  const handleLogout = async () => {
    try { await axios.post(`${API}/auth/logout`); } catch (error) { console.error('Logout error:', error); }
    setUser(null);
    setTasks([]);
    setStats(null);
    toast.success(t('loggedOut'));
  };
  
  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success(t('notificationsEnabled'));
      showNotification('FlowTask Pro', language === 'fr' ? 'Les notifications sont activées !' : 'Notifications are now enabled!');
    } else {
      toast.error(t('notificationsDenied'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }
  
  if (isAuthCallback) {
    return (
      <>
        <Toaster position="top-right" theme={theme} />
        <AuthCallback onLogin={(userData) => { setUser(userData); window.history.replaceState(null, '', '/'); }} />
      </>
    );
  }
  
  if (!user) {
    return (
      <>
        <Toaster position="top-right" theme={theme} />
        <AuthPage onLogin={setUser} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" theme={theme} toastOptions={{ style: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' } }} />
      
      {/* Desktop Header */}
      <header className="hidden md:block fixed top-0 left-0 right-0 glass-strong z-40 border-b border-border/50">
        <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-flow flex items-center justify-center animate-neon-glow">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold neon-text">FlowTask Pro</h1>
          </div>
          
          <nav className="flex gap-2">
            {[{ id: 'dashboard', label: t('dashboard'), icon: Home }, { id: 'manager', label: t('taskManager'), icon: ListTodo }, { id: 'ai', label: t('aiAssistant'), icon: Bot }].map(({ id, label, icon: Icon }) => (
              <button key={id} data-testid={`nav-${id}`} onClick={() => setActiveSection(id)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${activeSection === id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
          
          <div className="flex items-center gap-2">
            {!notificationsEnabled && (
              <button onClick={enableNotifications} className="p-2 rounded-xl hover:bg-muted transition-colors text-amber-500" data-testid="enable-notifications" title={t('enableNotifications')}>
                <BellRing className="w-5 h-5" />
              </button>
            )}
            <LanguageToggle />
            <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-muted transition-colors" data-testid="theme-toggle">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50">
              {user.picture ? <img src={user.picture} alt="" className="w-6 h-6 rounded-full" /> : <User className="w-5 h-5 text-muted-foreground" />}
              <span className="text-sm font-medium">{user.name?.split(' ')[0]}</span>
            </div>
            
            <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-destructive/10 text-destructive transition-colors" data-testid="logout-btn">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-border/50 z-50 safe-area-bottom">
        <div className="flex items-center justify-around py-3 px-4">
          {[{ id: 'dashboard', label: t('home'), icon: Home }, { id: 'manager', label: t('tasks'), icon: ListTodo }, { id: 'ai', label: t('ai'), icon: Bot }].map(({ id, label, icon: Icon }) => (
            <button key={id} data-testid={`mobile-nav-${id}`} onClick={() => setActiveSection(id)} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all touch-target ${activeSection === id ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}>
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
          <button onClick={toggleLanguage} className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-muted-foreground touch-target" data-testid="mobile-language-toggle">
            <Languages className="w-6 h-6" />
            <span className="text-[10px] font-medium">{language.toUpperCase()}</span>
          </button>
        </div>
      </nav>
      
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 glass-strong z-40 border-b border-border/50 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-flow flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold">FlowTask</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2" data-testid="mobile-theme-toggle">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {user.picture ? <img src={user.picture} alt="" className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>}
            <button onClick={handleLogout} className="p-2 text-destructive" data-testid="mobile-logout-btn">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-7xl md:pt-28 pt-20 pb-28 md:pb-8">
        {activeSection === 'dashboard' && <DashboardSection tasks={tasks} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onToggleTask={toggleTask} onEditTask={() => setActiveSection('manager')} onDeleteTask={deleteTask} onQuickAdd={quickAddTask} stats={stats} user={user} />}
        {activeSection === 'manager' && <TaskManagerSection tasks={tasks} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} onToggleTask={toggleTask} onReorderTasks={reorderTasks} />}
        {activeSection === 'ai' && <AIAssistantSection sessionId={sessionId} />}
      </main>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
