/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDoc,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, loginWithGoogle, logout } from './firebase';
import { Course, Post, UserProfile } from './types';
import { 
  Shield, 
  BookOpen, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronRight, 
  Menu, 
  X,
  Flame,
  Award,
  Users,
  Phone,
  Mail,
  MapPin,
  Settings,
  LayoutDashboard,
  FileText,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we might show a toast here
}

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-red-600 text-white hover:bg-red-700 shadow-[0_0_15px_rgba(220,38,38,0.4)]',
    secondary: 'bg-sky-100 text-red-600 hover:bg-sky-200 border border-red-200/30',
    outline: 'bg-transparent border border-red-600 text-red-600 hover:bg-red-600/10',
    ghost: 'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-sky-100',
    danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'
  };
  
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    className={cn('bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm', className)}
    onClick={onClick}
  >
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-12 text-center">
    <motion.h2 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight"
    >
      {title}
    </motion.h2>
    {subtitle && (
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-slate-600 max-w-2xl mx-auto"
      >
        {subtitle}
      </motion.p>
    )}
    <div className="w-20 h-1 bg-red-600 mx-auto mt-6 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'courses' | 'community' | 'support' | 'admin'>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Auth & Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          setProfile({ uid: u.uid, ...userDoc.data() } as UserProfile);
        } else {
          // Default profile for new users
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            role: u.email === 'whtmdals222@gmail.com' ? 'admin' : 'student',
            displayName: u.displayName || ''
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    const coursesQuery = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'courses'));

    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'posts'));

    return () => {
      unsubscribeCourses();
      unsubscribePosts();
    };
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const isAdmin = profile?.role === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-red-100 border-t-red-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Flame className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 text-slate-700 font-sans selection:bg-red-600/30 selection:text-red-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-sky-100">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-orange-700 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-black tracking-tight leading-none">퍼스트안전</h1>
              <p className="text-[10px] text-red-500 font-medium tracking-widest uppercase mt-1">Lifelong Education</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { id: 'home', label: '교육원 소개' },
              { id: 'courses', label: '교육 과정' },
              { id: 'community', label: '커뮤니티' },
              { id: 'support', label: '고객지원' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-red-600',
                  activeTab === item.id ? 'text-red-600' : 'text-slate-500'
                )}
              >
                {item.label}
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={cn(
                  'text-sm font-medium flex items-center gap-2 transition-colors hover:text-red-600',
                  activeTab === 'admin' ? 'text-red-600' : 'text-slate-500'
                )}
              >
                <Settings className="w-4 h-4" />
                관리자
              </button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-slate-400">반갑습니다</span>
                  <span className="text-sm font-medium text-slate-900">{profile?.displayName || user.email}</span>
                </div>
                <Button variant="ghost" className="p-2" onClick={logout}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Button onClick={loginWithGoogle}>
                <UserIcon className="w-4 h-4" />
                로그인
              </Button>
            )}
            <button className="md:hidden p-2 text-slate-500" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-sky-50 pt-24 px-4 md:hidden"
          >
            <div className="flex flex-col gap-6">
              {[
                { id: 'home', label: '교육원 소개' },
                { id: 'courses', label: '교육 과정' },
                { id: 'community', label: '커뮤니티' },
                { id: 'support', label: '고객지원' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as any); setIsMenuOpen(false); }}
                  className="text-2xl font-bold text-left text-slate-500 hover:text-red-600"
                >
                  {item.label}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => { setActiveTab('admin'); setIsMenuOpen(false); }}
                  className="text-2xl font-bold text-left text-red-600"
                >
                  관리자 대시보드
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-20">
        {activeTab === 'home' && <HomeView setActiveTab={setActiveTab} posts={posts} />}
        {activeTab === 'courses' && <CoursesView courses={courses} />}
        {activeTab === 'community' && <CommunityView posts={posts} />}
        {activeTab === 'support' && <SupportView />}
        {activeTab === 'admin' && isAdmin && <AdminDashboard courses={courses} posts={posts} />}
      </main>

      {/* Footer */}
      <footer className="bg-sky-100 border-t border-sky-200 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="text-red-600 w-8 h-8" />
                <h2 className="text-2xl font-bold text-slate-900">퍼스트안전평생교육원</h2>
              </div>
              <p className="text-slate-600 max-w-md mb-8 leading-relaxed">
                대한민국 최고의 소방안전 전문가를 양성하는 프리미엄 평생교육원입니다. 
                최신 시설과 실무 중심의 커리큘럼으로 여러분의 꿈을 지원합니다.
              </p>
              <div className="flex gap-4">
                <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                </button>
                <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors">
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-slate-900 font-bold mb-6">교육 과정</h3>
              <ul className="space-y-4 text-slate-600 text-sm">
                <li className="hover:text-red-600 cursor-pointer">소방시설관리사</li>
                <li className="hover:text-red-600 cursor-pointer">소방안전관리자 1급/2급</li>
                <li className="hover:text-red-600 cursor-pointer">위험물안전관리자</li>
                <li className="hover:text-red-600 cursor-pointer">기업 맞춤형 안전교육</li>
              </ul>
            </div>
            <div>
              <h3 className="text-slate-900 font-bold mb-6">고객 센터</h3>
              <ul className="space-y-4 text-slate-600 text-sm">
                <li>상담전화: 02-123-4567</li>
                <li>운영시간: 평일 09:00 - 18:00</li>
                <li>이메일: info@firstsafety.kr</li>
                <li>주소: 서울특별시 강서구 초원로 16-1 4층 123</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-sky-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
            <p>© 2026 퍼스트안전평생교육원. All Rights Reserved.</p>
            <div className="flex gap-6">
              <span className="hover:text-slate-600 cursor-pointer">이용약관</span>
              <span className="hover:text-slate-600 cursor-pointer font-bold">개인정보처리방침</span>
              <span className="hover:text-slate-600 cursor-pointer">이메일무단수집거부</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Views ---

function HomeView({ setActiveTab, posts }: { setActiveTab: any, posts: Post[] }) {
  return (
    <div>
      {/* Hero */}
      <section className="relative h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1516533075015-a3838414c3ca?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-20"
            referrerPolicy="no-referrer"
            alt="Fire Safety Background"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-sky-50/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-sky-50 to-transparent" />
          {/* Neon Glows */}
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-red-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 w-full">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-widest mb-6">
              <Award className="w-3 h-3" />
              대한민국 No.1 소방안전 교육기관
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-8 leading-[1.1] tracking-tight">
              안전의 가치를 <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600">퍼스트</span>에서 시작하세요
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
              퍼스트안전평생교육원은 실무 중심의 체계적인 커리큘럼과 
              최고의 강사진을 통해 당신을 소방안전 전문가로 이끌어 드립니다.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button className="h-14 px-8 text-lg" onClick={() => setActiveTab('courses')}>
                교육과정 보기
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" className="h-14 px-8 text-lg" onClick={() => setActiveTab('support')}>
                상담 신청하기
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-sky-100/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: '누적 수강생', value: '15,000+', icon: Users },
              { label: '자격증 합격률', value: '94%', icon: Award },
              { label: '보유 교육과정', value: '45+', icon: BookOpen },
              { label: '취업 연계율', value: '88%', icon: Shield }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-6 rounded-2xl bg-white border border-sky-100 shadow-sm"
              >
                <stat.icon className="w-8 h-8 text-red-600 mx-auto mb-4" />
                <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-4">
          <SectionTitle 
            title="왜 퍼스트안전인가?" 
            subtitle="우리는 단순한 지식 전달을 넘어, 현장에서 즉시 활용 가능한 실무 능력을 배양합니다." 
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: '최고의 강사진',
                desc: '현장 경력 20년 이상의 베테랑 기술사 및 교수진이 직접 강의합니다.',
                icon: GraduationCap,
                color: 'from-red-600 to-orange-600'
              },
              {
                title: '실무 중심 교육',
                desc: '이론에만 그치지 않고 실제 소방 시설물을 활용한 실습 교육을 병행합니다.',
                icon: LayoutDashboard,
                color: 'from-indigo-600 to-blue-600'
              },
              {
                title: '취업 및 창업 지원',
                desc: '수료 후에도 지속적인 커리어 관리와 네트워크를 통해 성공을 돕습니다.',
                icon: Shield,
                color: 'from-blue-600 to-cyan-600'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -10 }}
                className="group p-8 rounded-3xl bg-white border border-sky-100 shadow-sm hover:border-red-500/50 transition-all duration-300"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br shadow-lg", feature.color)}>
                  <feature.icon className="text-white w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-red-600 transition-colors">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest News */}
      <section className="py-32 bg-sky-100/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">최신 소식</h2>
              <p className="text-slate-600">교육원의 새로운 소식과 공지사항을 확인하세요.</p>
            </div>
            <Button variant="ghost" onClick={() => setActiveTab('community')}>전체보기</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.slice(0, 4).map((post) => (
              <Card key={post.id} className="p-6 hover:bg-white transition-colors cursor-pointer group shadow-sm">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                    post.type === 'notice' ? "bg-red-50 text-red-600 border border-red-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                  )}>
                    {post.type === 'notice' ? '공지' : '뉴스'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-red-600 transition-colors line-clamp-1">{post.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-1 mb-4">{post.content.replace(/[#*`]/g, '')}</p>
                    <div className="text-xs text-slate-400">
                      {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : '방금 전'}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-red-600 transition-colors" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function CoursesView({ courses }: { courses: Course[] }) {
  const categories = ['전체', ...Array.from(new Set(courses.map(c => c.category)))];
  const [activeCategory, setActiveCategory] = useState('전체');

  const filteredCourses = activeCategory === '전체' 
    ? courses 
    : courses.filter(c => c.category === activeCategory);

  return (
    <div className="py-20 max-w-7xl mx-auto px-4">
      <SectionTitle title="교육 과정" subtitle="당신의 커리어를 한 단계 높여줄 전문 교육 프로그램입니다." />
      
      <div className="flex flex-wrap gap-2 mb-12 justify-center">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-medium transition-all",
              activeCategory === cat 
                ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]" 
                : "bg-white text-slate-500 hover:text-slate-700 border border-sky-100"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredCourses.length > 0 ? filteredCourses.map((course, i) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="group hover:border-red-500/50 transition-all duration-300 shadow-sm">
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={course.imageUrl || `https://picsum.photos/seed/${course.id}/800/450`} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  alt={course.title}
                />
                <div className="absolute top-4 left-4 px-3 py-1 bg-white/80 backdrop-blur-md rounded-full text-[10px] font-bold text-red-600 border border-red-100">
                  {course.category}
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-red-600 transition-colors">{course.title}</h3>
                <p className="text-slate-600 text-sm mb-6 line-clamp-2 leading-relaxed">{course.description}</p>
                <div className="flex items-center justify-between pt-6 border-t border-sky-100">
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    수강기간: {course.duration || '상시모집'}
                  </div>
                  <div className="text-lg font-bold text-red-500">
                    {course.price ? `${course.price.toLocaleString()}원` : '상담문의'}
                  </div>
                </div>
                <Button className="w-full mt-6" variant="secondary">상세보기</Button>
              </div>
            </Card>
          </motion.div>
        )) : (
          <div className="col-span-full py-20 text-center text-zinc-600">
            등록된 교육 과정이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityView({ posts }: { posts: Post[] }) {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  return (
    <div className="py-20 max-w-4xl mx-auto px-4">
      <SectionTitle title="커뮤니티" subtitle="교육원의 공지사항과 새로운 소식을 전해드립니다." />
      
      {selectedPost ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button variant="ghost" onClick={() => setSelectedPost(null)} className="mb-8">
            <ChevronRight className="w-4 h-4 rotate-180" />
            목록으로 돌아가기
          </Button>
          <div className="bg-white border border-sky-100 rounded-3xl p-8 md:p-12 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase",
                selectedPost.type === 'notice' ? "bg-red-50 text-red-600 border border-red-100" : "bg-blue-50 text-blue-600 border border-blue-100"
              )}>
                {selectedPost.type === 'notice' ? '공지사항' : '뉴스'}
              </span>
              <span className="text-slate-400 text-sm">
                {selectedPost.createdAt?.toDate ? selectedPost.createdAt.toDate().toLocaleDateString() : '방금 전'}
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8">{selectedPost.title}</h2>
            <div className="prose prose-red max-w-none">
              <ReactMarkdown>{selectedPost.content}</ReactMarkdown>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {posts.length > 0 ? posts.map((post) => (
            <Card key={post.id} className="p-6 hover:bg-white transition-colors cursor-pointer shadow-sm" onClick={() => setSelectedPost(post)}>
              <div className="flex items-center gap-6">
                <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 text-slate-400">
                  <span className="text-xs uppercase font-bold">{post.createdAt?.toDate ? post.createdAt.toDate().toLocaleString('en-US', { month: 'short' }) : 'MAR'}</span>
                  <span className="text-xl font-bold text-slate-900">{post.createdAt?.toDate ? post.createdAt.toDate().getDate() : '23'}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      post.type === 'notice' ? "text-red-600" : "text-blue-600"
                    )}>
                      {post.type === 'notice' ? 'Notice' : 'News'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{post.title}</h3>
                  <p className="text-slate-600 text-sm line-clamp-1">{post.content.replace(/[#*`]/g, '')}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </Card>
          )) : (
            <div className="text-center py-20 text-slate-400">등록된 게시물이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

function SupportView() {
  return (
    <div className="py-20 max-w-7xl mx-auto px-4">
      <SectionTitle title="고객 지원" subtitle="궁금하신 점이 있다면 언제든 문의해 주세요." />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-8">자주 묻는 질문</h3>
          <div className="space-y-4">
            {[
              { q: '수강 신청은 어떻게 하나요?', a: '홈페이지에서 로그인 후 원하는 교육 과정을 선택하여 신청하실 수 있습니다. 단체 수강의 경우 고객센터로 별도 문의 바랍니다.' },
              { q: '자격증 시험 응시 자격이 궁금합니다.', a: '각 자격증마다 응시 자격이 다릅니다. 상세 페이지의 응시 자격 안내를 확인하시거나 상담 신청을 남겨주세요.' },
              { q: '교육비 환불 규정은 어떻게 되나요?', a: '평생교육법 시행령에 의거하여 교육 시작 전에는 전액 환불이 가능하며, 시작 후에는 경과 시간에 따라 차등 환불됩니다.' }
            ].map((faq, i) => (
              <details key={i} className="group bg-white border border-sky-100 rounded-2xl p-6 cursor-pointer shadow-sm">
                <summary className="flex items-center justify-between font-bold text-slate-900 list-none">
                  {faq.q}
                  <ChevronRight className="w-5 h-5 text-slate-300 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="mt-4 text-slate-600 text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
        
        <Card className="p-8 md:p-10 shadow-sm">
          <h3 className="text-2xl font-bold text-slate-900 mb-8">1:1 문의하기</h3>
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">이름</label>
                <input type="text" className="w-full bg-white border border-sky-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-600 transition-colors" placeholder="홍길동" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">연락처</label>
                <input type="text" className="w-full bg-white border border-sky-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-600 transition-colors" placeholder="010-0000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">문의 유형</label>
              <select className="w-full bg-white border border-sky-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-600 transition-colors appearance-none">
                <option>교육 과정 문의</option>
                <option>수강료 및 결제 문의</option>
                <option>자격증 취득 문의</option>
                <option>기타 문의</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">내용</label>
              <textarea rows={4} className="w-full bg-white border border-sky-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-600 transition-colors resize-none" placeholder="문의하실 내용을 입력해 주세요." />
            </div>
            <Button className="w-full h-14 text-lg">문의 제출하기</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// --- Admin Dashboard ---

function AdminDashboard({ courses, posts }: { courses: Course[], posts: Post[] }) {
  const [view, setView] = useState<'overview' | 'courses' | 'posts'>('overview');
  const [isEditingCourse, setIsEditingCourse] = useState<Partial<Course> | null>(null);
  const [isEditingPost, setIsEditingPost] = useState<Partial<Post> | null>(null);

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingCourse) return;
    try {
      if (isEditingCourse.id) {
        await updateDoc(doc(db, 'courses', isEditingCourse.id), { ...isEditingCourse, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'courses'), { ...isEditingCourse, createdAt: serverTimestamp() });
      }
      setIsEditingCourse(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'courses');
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingPost) return;
    try {
      if (isEditingPost.id) {
        await updateDoc(doc(db, 'posts', isEditingPost.id), { ...isEditingPost, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'posts'), { ...isEditingPost, createdAt: serverTimestamp() });
      }
      setIsEditingPost(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'posts');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'posts', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'posts');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-2">
          <button 
            onClick={() => setView('overview')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
              view === 'overview' ? "bg-red-600 text-white shadow-lg" : "text-slate-500 hover:bg-sky-100"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            대시보드 개요
          </button>
          <button 
            onClick={() => setView('courses')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
              view === 'courses' ? "bg-red-600 text-white shadow-lg" : "text-slate-500 hover:bg-sky-100"
            )}
          >
            <BookOpen className="w-5 h-5" />
            교육 과정 관리
          </button>
          <button 
            onClick={() => setView('posts')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
              view === 'posts' ? "bg-red-600 text-white shadow-lg" : "text-slate-500 hover:bg-sky-100"
            )}
          >
            <FileText className="w-5 h-5" />
            게시물 관리
          </button>
        </div>

        {/* Content */}
        <div className="flex-1">
          {view === 'overview' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-bold text-slate-900">관리자 대시보드</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <Card className="p-6 shadow-sm">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-2">전체 교육 과정</div>
                  <div className="text-4xl font-bold text-slate-900">{courses.length}</div>
                </Card>
                <Card className="p-6 shadow-sm">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-2">전체 게시물</div>
                  <div className="text-4xl font-bold text-slate-900">{posts.length}</div>
                </Card>
                <Card className="p-6 shadow-sm">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-2">신규 문의</div>
                  <div className="text-4xl font-bold text-red-500">0</div>
                </Card>
              </div>
            </div>
          )}

          {view === 'courses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">교육 과정 관리</h2>
                <Button onClick={() => setIsEditingCourse({})}>
                  <Plus className="w-4 h-4" />
                  새 과정 추가
                </Button>
              </div>

              {isEditingCourse && (
                <Card className="p-6 border-red-500/30 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">{isEditingCourse.id ? '과정 수정' : '새 과정 등록'}</h3>
                  <form onSubmit={handleSaveCourse} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                        className="bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                        placeholder="과정명" 
                        value={isEditingCourse.title || ''} 
                        onChange={e => setIsEditingCourse({...isEditingCourse, title: e.target.value})}
                        required
                      />
                      <input 
                        className="bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                        placeholder="카테고리" 
                        value={isEditingCourse.category || ''} 
                        onChange={e => setIsEditingCourse({...isEditingCourse, category: e.target.value})}
                        required
                      />
                      <input 
                        type="number"
                        className="bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                        placeholder="수강료 (숫자만)" 
                        value={isEditingCourse.price || ''} 
                        onChange={e => setIsEditingCourse({...isEditingCourse, price: Number(e.target.value)})}
                      />
                      <input 
                        className="bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                        placeholder="교육 기간 (예: 4주)" 
                        value={isEditingCourse.duration || ''} 
                        onChange={e => setIsEditingCourse({...isEditingCourse, duration: e.target.value})}
                      />
                    </div>
                    <textarea 
                      className="w-full bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                      placeholder="과정 설명" 
                      rows={3}
                      value={isEditingCourse.description || ''} 
                      onChange={e => setIsEditingCourse({...isEditingCourse, description: e.target.value})}
                      required
                    />
                    <input 
                      className="w-full bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                      placeholder="이미지 URL" 
                      value={isEditingCourse.imageUrl || ''} 
                      onChange={e => setIsEditingCourse({...isEditingCourse, imageUrl: e.target.value})}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" type="button" onClick={() => setIsEditingCourse(null)}>취소</Button>
                      <Button type="submit">저장하기</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="space-y-2">
                {courses.map(course => (
                  <div key={course.id} className="flex items-center justify-between p-4 bg-white border border-sky-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-sky-50 overflow-hidden">
                        <img src={course.imageUrl || `https://picsum.photos/seed/${course.id}/100/100`} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                      </div>
                      <div>
                        <div className="text-slate-900 font-bold">{course.title}</div>
                        <div className="text-xs text-slate-500">{course.category} | {course.price?.toLocaleString()}원</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="p-2" onClick={() => setIsEditingCourse(course)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="danger" className="p-2" onClick={() => handleDeleteCourse(course.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'posts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">게시물 관리</h2>
                <Button onClick={() => setIsEditingPost({ type: 'notice' })}>
                  <Plus className="w-4 h-4" />
                  새 게시물 작성
                </Button>
              </div>

              {isEditingPost && (
                <Card className="p-6 border-red-500/30 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">{isEditingPost.id ? '게시물 수정' : '새 게시물 작성'}</h3>
                  <form onSubmit={handleSavePost} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                        className="bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                        placeholder="제목" 
                        value={isEditingPost.title || ''} 
                        onChange={e => setIsEditingPost({...isEditingPost, title: e.target.value})}
                        required
                      />
                      <select 
                        className="bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900" 
                        value={isEditingPost.type || 'notice'} 
                        onChange={e => setIsEditingPost({...isEditingPost, type: e.target.value as any})}
                      >
                        <option value="notice">공지사항</option>
                        <option value="news">뉴스</option>
                      </select>
                    </div>
                    <textarea 
                      className="w-full bg-white border border-sky-200 rounded-lg px-4 py-2 text-slate-900 font-mono text-sm" 
                      placeholder="내용 (Markdown 지원)" 
                      rows={10}
                      value={isEditingPost.content || ''} 
                      onChange={e => setIsEditingPost({...isEditingPost, content: e.target.value})}
                      required
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" type="button" onClick={() => setIsEditingPost(null)}>취소</Button>
                      <Button type="submit">저장하기</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="space-y-2">
                {posts.map(post => (
                  <div key={post.id} className="flex items-center justify-between p-4 bg-white border border-sky-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase",
                        post.type === 'notice' ? "bg-red-50 text-red-600 border border-red-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                      )}>
                        {post.type === 'notice' ? '공지' : '뉴스'}
                      </div>
                      <div>
                        <div className="text-slate-900 font-bold line-clamp-1">{post.title}</div>
                        <div className="text-xs text-slate-400">{post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : '방금 전'}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="p-2" onClick={() => setIsEditingPost(post)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="danger" className="p-2" onClick={() => handleDeletePost(post.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
