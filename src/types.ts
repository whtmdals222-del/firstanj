export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  price?: number;
  duration?: string;
  imageUrl?: string;
  createdAt: any;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author?: string;
  type: 'notice' | 'news';
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'student';
  displayName?: string;
}
