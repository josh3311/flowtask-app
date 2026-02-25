import { useState, useEffect, useCallback, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { 
  Calendar, 
  CheckCircle2, 
  Circle, 
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
  X,
  Sparkles,
  TrendingUp,
  Clock,
  AlertCircle,
  Volume2
} from "lucide-react";
import { Toaster, toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Utility functions
const formatDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (dateKey) => {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateKey === formatDateKey(today)) return 'Today';
  if (dateKey === formatDateKey(yesterday)) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Priority badge component
const PriorityBadge = ({ priority }) => {
  const colors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  };
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[priority] || colors.medium}`}>
      {priority}
    </span>
  );
};

// Task Card Component
const TaskCard = ({ task, onToggle, onEdit, onDelete, showDate = false }) => {
  return (
    <div 
      data-testid={`task-card-${task.id}`}
      className={`glass rounded-xl p-4 border border-white/5 transition-all duration-300 hover:border-primary/30 group ${task.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        <button
          data-testid={`toggle-task-${task.id}`}
          onClick={() => onToggle(task.id, !task.completed)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all touch-target ${
            task.completed 
              ? 'bg-emerald-500 border-emerald-500' 
              : 'border-muted-foreground/50 hover:border-primary'
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
                {formatDisplayDate(task.date)}
              </span>
            )}
            {task.audio_base64 && (
              <button 
                onClick={() => {
                  const audio = new Audio(task.audio_base64);
                  audio.play();
                }}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Volume2 className="w-3 h-3" /> Voice
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <PriorityBadge priority={task.priority} />
          <button 
            data-testid={`edit-task-${task.id}`}
            onClick={() => onEdit(task)}
            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors opacity-0 group-hover:opacity-100 touch-target"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button 
            data-testid={`delete-task-${task.id}`}
            onClick={() => onDelete(task.id)}
            className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors opacity-0 group-hover:opacity-100 touch-target"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Dashboard Section
const DashboardSection = ({ tasks, selectedDate, setSelectedDate, onToggleTask, onEditTask, onDeleteTask, onQuickAdd, stats }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [quickTaskText, setQuickTaskText] = useState('');
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  
  const dayTasks = tasks.filter(t => t.date === formatDateKey(selectedDate));
  const completedCount = dayTasks.filter(t => t.completed).length;
  const progress = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;
  
  const handleQuickAdd = () => {
    if (!quickTaskText.trim()) return;
    onQuickAdd(quickTaskText, formatDateKey(selectedDate));
    setQuickTaskText('');
  };
  
  const changeMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };
  
  // Generate calendar days
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <header className="mb-8 text-left">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">FlowTask</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          You have <span className="text-primary font-semibold">{stats?.pending || 0}</span> tasks pending
        </p>
      </header>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column - Calendar & Quick Add */}
        <div className="lg:col-span-5 space-y-6">
          {/* Calendar Card */}
          <div className="glass rounded-2xl p-6 neon-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {MONTHS[month]} {year}
              </h2>
              <div className="flex gap-1">
                <button 
                  data-testid="prev-month-btn"
                  onClick={() => changeMonth(-1)} 
                  className="p-2 hover:bg-muted rounded-lg transition-colors touch-target"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  data-testid="next-month-btn"
                  onClick={() => changeMonth(1)} 
                  className="p-2 hover:bg-muted rounded-lg transition-colors touch-target"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="h-10" />;
                }
                
                const dateKey = formatDateKey(new Date(year, month, day));
                const dayTaskList = tasks.filter(t => t.date === dateKey);
                const dayCompleted = dayTaskList.filter(t => t.completed).length;
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
                
                return (
                  <button
                    key={day}
                    data-testid={`calendar-day-${day}`}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`h-10 rounded-lg flex flex-col items-center justify-center cursor-pointer relative transition-all touch-target ${
                      isToday ? 'gradient-flow text-white font-bold' : 
                      isSelected ? 'bg-primary/20 border border-primary text-primary' : 
                      'hover:bg-muted'
                    }`}
                  >
                    <span className="text-sm font-medium">{day}</span>
                    {dayTaskList.length > 0 && (
                      <div className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                        dayCompleted === dayTaskList.length ? 'bg-emerald-500' : 
                        dayCompleted > 0 ? 'bg-primary' : 'bg-amber-500'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Selected date info */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Selected</p>
                  <p className="text-lg font-semibold">
                    {formatDateKey(selectedDate) === formatDateKey(today) ? 'Today' : 
                      selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Progress</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full gradient-flow rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
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
              Quick Add
            </h3>
            <div className="flex gap-2">
              <input
                data-testid="quick-add-input"
                type="text"
                value={quickTaskText}
                onChange={(e) => setQuickTaskText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleQuickAdd()}
                placeholder="What needs to be done?"
                className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
              />
              <button
                data-testid="quick-add-btn"
                onClick={handleQuickAdd}
                className="px-4 py-3 gradient-flow text-white rounded-xl font-medium transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Column - Daily Flow & Tasks */}
        <div className="lg:col-span-7 space-y-6">
          {/* Daily Flow Map */}
          <div className="glass rounded-2xl p-6 neon-border min-h-[160px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Daily Flow
              </h3>
              <span className="text-xs px-3 py-1 bg-primary/20 text-primary rounded-full">
                {dayTasks.length} tasks
              </span>
            </div>
            
            <div className="flex items-center gap-4 overflow-x-auto pb-4 px-1 min-h-[100px] snap-x">
              {dayTasks.length === 0 ? (
                <div className="text-muted-foreground text-center w-full py-8 text-sm">
                  No tasks for this day. Add one to see your flow!
                </div>
              ) : (
                dayTasks.map((task, index) => (
                  <div key={task.id} className="flex-shrink-0 relative snap-start animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-110 ${
                      task.completed ? 'gradient-success' : 'gradient-flow'
                    }`}>
                      {task.completed ? (
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      ) : (
                        <span className="text-xl font-bold text-white">{index + 1}</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium text-muted-foreground truncate w-16 md:w-20 text-center">
                      {task.text}
                    </p>
                    {index < dayTasks.length - 1 && (
                      <div className="absolute top-8 -right-3 w-6 h-0.5 bg-gradient-to-r from-primary to-accent hidden md:block" />
                    )}
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
                <p className="text-muted-foreground text-sm">No tasks for this day</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Add one above to get started</p>
              </div>
            ) : (
              dayTasks.map((task, index) => (
                <div key={task.id} className="animate-slide-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <TaskCard
                    task={task}
                    onToggle={onToggleTask}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Task Manager Section
const TaskManagerSection = ({ tasks, onCreateTask, onUpdateTask, onDeleteTask, onToggleTask }) => {
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    text: '',
    date: formatDateKey(new Date()),
    priority: 'medium',
    audio_base64: null
  });
  const [isRecording, setIsRecording] = useState(false);
  const [filterDate, setFilterDate] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Get unique dates for filter
  const uniqueDates = [...new Set(tasks.map(t => t.date))].sort();
  
  // Filter tasks
  let filteredTasks = [...tasks];
  if (filterDate !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.date === filterDate);
  }
  if (filterPriority !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.priority === filterPriority);
  }
  
  // Sort by date then priority
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  filteredTasks.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.text.trim() || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (editingTask) {
      await onUpdateTask(editingTask.id, formData);
      toast.success('Task updated!');
    } else {
      await onCreateTask(formData);
      toast.success('Task created!');
    }
    
    resetForm();
  };
  
  const resetForm = () => {
    setFormData({
      text: '',
      date: formatDateKey(new Date()),
      priority: 'medium',
      audio_base64: null
    });
    setEditingTask(null);
  };
  
  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      text: task.text,
      date: task.date,
      priority: task.priority,
      audio_base64: task.audio_base64
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            setFormData(prev => ({ ...prev, audio_base64: reader.result }));
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorderRef.current.start(1000);
        setIsRecording(true);
        toast.info('Recording started...');
      } catch (err) {
        toast.error('Microphone access denied');
      }
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      toast.success('Recording saved!');
    }
  };

  return (
    <div className="animate-slide-up">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">Task Manager</span>
        </h1>
        <p className="text-muted-foreground">Full control over your tasks</p>
      </header>
      
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 neon-border sticky top-24">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {editingTask ? <Edit3 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-emerald-500" />}
              {editingTask ? 'Edit Task' : 'New Task'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Task Name
                </label>
                <input
                  data-testid="task-name-input"
                  type="text"
                  value={formData.text}
                  onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Enter task description..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  data-testid="task-date-input"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['low', 'medium', 'high'].map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      data-testid={`priority-${priority}`}
                      onClick={() => setFormData(prev => ({ ...prev, priority }))}
                      className={`py-2 rounded-lg border-2 text-sm font-medium transition-all touch-target ${
                        formData.priority === priority
                          ? priority === 'high' ? 'border-red-500 bg-red-500/20 text-red-400'
                          : priority === 'medium' ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                          : 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Voice Recording */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Voice Note
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="record-btn"
                    onClick={toggleRecording}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md touch-target ${
                      isRecording ? 'gradient-danger animate-pulse-ring' : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                  </button>
                  <div className="flex-1">
                    {isRecording && (
                      <span className="text-sm text-red-400">Recording... Tap to stop</span>
                    )}
                    {formData.audio_base64 && !isRecording && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const audio = new Audio(formData.audio_base64);
                            audio.play();
                          }}
                          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Play className="w-4 h-4" /> Play Recording
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, audio_base64: null }))}
                          className="text-xs text-red-500 hover:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 border border-border text-foreground rounded-xl hover:bg-muted transition-all font-medium text-sm"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  data-testid="submit-task-btn"
                  className="flex-1 py-3 gradient-flow text-white rounded-xl font-semibold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95"
                >
                  {editingTask ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Task List */}
        <div className="lg:col-span-2">
          <div className="glass rounded-2xl p-6 neon-border min-h-[600px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-semibold">All Tasks</h3>
              <div className="flex gap-2">
                <select
                  data-testid="filter-date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm focus:border-primary outline-none"
                >
                  <option value="all">All Dates</option>
                  {uniqueDates.map(date => (
                    <option key={date} value={date}>{formatDisplayDate(date)}</option>
                  ))}
                </select>
                <select
                  data-testid="filter-priority"
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm focus:border-primary outline-none"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No tasks found</p>
                </div>
              ) : (
                filteredTasks.map((task, index) => (
                  <div key={task.id} className="animate-slide-in" style={{ animationDelay: `${index * 0.03}s` }}>
                    <TaskCard
                      task={task}
                      onToggle={onToggleTask}
                      onEdit={handleEdit}
                      onDelete={onDeleteTask}
                      showDate={true}
                    />
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

// AI Assistant Section
const AIAssistantSection = ({ sessionId }) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm FlowAI, your intelligent task management assistant. I can help you:\n\n• Analyze your productivity patterns\n• Prioritize your pending tasks\n• Plan your schedule efficiently\n• Provide insights about your task completion\n\nTry asking: \"What should I prioritize today?\" or \"How productive am I this week?\""
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API}/chat`, {
        session_id: sessionId,
        message: inputText
      });
      
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get AI response');
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const quickAsk = (question) => {
    setInputText(question);
    setTimeout(() => {
      document.getElementById('ai-send-btn')?.click();
    }, 100);
  };
  
  const clearChat = () => {
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: "Chat cleared! How can I help you today?"
    }]);
    axios.delete(`${API}/chat/history/${sessionId}`).catch(console.error);
  };

  return (
    <div className="animate-slide-up">
      <header className="mb-6 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">AI Assistant</span>
        </h1>
        <p className="text-muted-foreground">Smart task analysis powered by FlowAI</p>
      </header>
      
      <div className="max-w-3xl mx-auto">
        <div className="glass-strong rounded-2xl overflow-hidden flex flex-col h-[70vh] md:h-[600px] neon-border">
          {/* Chat Header */}
          <div className="gradient-flow p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm animate-float">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">FlowAI</h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <p className="text-white/70 text-xs">Powered by Gemini</p>
                </div>
              </div>
            </div>
            <button
              data-testid="clear-chat-btn"
              onClick={clearChat}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors touch-target"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex gap-3 animate-slide-in ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'assistant' ? 'gradient-flow' : 'bg-muted'
                }`}>
                  {message.role === 'assistant' ? (
                    <Zap className="w-5 h-5 text-white" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-foreground/20" />
                  )}
                </div>
                <div className={`max-w-[80%] md:max-w-[70%] rounded-2xl p-4 ${
                  message.role === 'assistant' 
                    ? 'glass rounded-tl-none' 
                    : 'bg-primary text-white rounded-tr-none'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 animate-slide-in">
                <div className="w-8 h-8 rounded-full gradient-flow flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="glass rounded-2xl rounded-tl-none p-4">
                  <div className="typing-indicator flex gap-1">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="p-4 bg-card border-t border-border/50 shrink-0">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {[
                'What should I prioritize today?',
                'Weekly productivity stats',
                'What tasks are pending?',
                'Help me plan my day'
              ].map((question, index) => (
                <button
                  key={index}
                  onClick={() => quickAsk(question)}
                  className="px-3 py-1.5 bg-muted hover:bg-primary/10 hover:text-primary rounded-full text-xs text-muted-foreground whitespace-nowrap transition-colors border border-transparent hover:border-primary/30"
                >
                  {question.split(' ').slice(0, 2).join(' ')}...
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <input
                data-testid="ai-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask anything about your tasks..."
                className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                disabled={isLoading}
              />
              <button
                id="ai-send-btn"
                data-testid="ai-send-btn"
                onClick={sendMessage}
                disabled={isLoading}
                className="px-6 py-3 gradient-flow text-white rounded-xl font-semibold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <span className="hidden sm:inline">Send</span>
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  
  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, []);
  
  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/tasks/stats/summary`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);
  
  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);
  
  // Task operations
  const createTask = async (taskData) => {
    try {
      await axios.post(`${API}/tasks`, taskData);
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };
  
  const updateTask = async (taskId, updates) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, updates);
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };
  
  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      fetchTasks();
      fetchStats();
      toast.success('Task deleted');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };
  
  const toggleTask = async (taskId, completed) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { completed });
      fetchTasks();
      fetchStats();
      if (completed) {
        toast.success('Task completed! 🎉');
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };
  
  const quickAddTask = async (text, date) => {
    await createTask({ text, date, priority: 'medium' });
    toast.success('Task added!');
  };
  
  const handleEditTask = (task) => {
    setActiveSection('manager');
    // The TaskManagerSection will handle the edit state
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster 
        position="top-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))'
          }
        }}
      />
      
      {/* Desktop Header */}
      <header className="hidden md:block fixed top-0 left-0 right-0 glass-strong z-40 border-b border-white/5">
        <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-flow flex items-center justify-center animate-neon-glow">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold neon-text">FlowTask Pro</h1>
          </div>
          <nav className="flex gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Home },
              { id: 'manager', label: 'Task Manager', icon: ListTodo },
              { id: 'ai', label: 'AI Assistant', icon: Bot }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-testid={`nav-${id}`}
                onClick={() => setActiveSection(id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                  activeSection === id 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-white/5 z-50 safe-area-bottom">
        <div className="flex items-center justify-around py-3 px-4">
          {[
            { id: 'dashboard', label: 'Home', icon: Home },
            { id: 'manager', label: 'Tasks', icon: ListTodo },
            { id: 'ai', label: 'AI', icon: Bot }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`mobile-nav-${id}`}
              onClick={() => setActiveSection(id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all touch-target ${
                activeSection === id 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-7xl md:pt-28 pb-28 md:pb-8 safe-area-top">
        {activeSection === 'dashboard' && (
          <DashboardSection
            tasks={tasks}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onToggleTask={toggleTask}
            onEditTask={handleEditTask}
            onDeleteTask={deleteTask}
            onQuickAdd={quickAddTask}
            stats={stats}
          />
        )}
        
        {activeSection === 'manager' && (
          <TaskManagerSection
            tasks={tasks}
            onCreateTask={createTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onToggleTask={toggleTask}
          />
        )}
        
        {activeSection === 'ai' && (
          <AIAssistantSection sessionId={sessionId} />
        )}
      </main>
    </div>
  );
}

export default App;
