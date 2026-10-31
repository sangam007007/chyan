import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { AppLayout } from '@/components/layouts/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { GoogleCallbackPage } from '@/pages/GoogleCallbackPage';
import { OTPVerifyPage } from '@/pages/OTPVerifyPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage';
import { TestListPage } from '@/pages/TestListPage';
import { TestAttemptPage } from '@/pages/TestAttemptPage';
import { TestResultsPage } from '@/pages/TestResultsPage';
import { MyResultsPage } from '@/pages/MyResultsPage';
import { AnswerReviewPage } from '@/pages/AnswerReviewPage';
import { StudyPlanPage } from '@/pages/StudyPlanPage';
import { SubjectDetailPage } from '@/pages/SubjectDetailPage';
import { TopicDetailPage } from '@/pages/TopicDetailPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { DailyChallengePage } from '@/pages/DailyChallengePage';
import { CommunityPage } from '@/pages/CommunityPage';

// Admin imports
import { AdminGuard } from '@/admin/components/AdminGuard';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { AdminDashboard } from '@/admin/pages/AdminDashboard';
import { AdminQuestions } from '@/admin/pages/AdminQuestions';
import { AdminTests } from '@/admin/pages/AdminTests';
import { AdminUsers } from '@/admin/pages/AdminUsers';
import { AdminUserDetail } from '@/admin/pages/AdminUserDetail';
import { AdminExams } from '@/admin/pages/AdminExams';
import { AdminSubjects } from '@/admin/pages/AdminSubjects';
import { AdminImport } from '@/admin/pages/AdminImport';
import { AdminActivity } from '@/admin/pages/AdminActivity';
import { QuestionEditor } from '@/admin/pages/QuestionEditor';
import { TestWizard } from '@/admin/pages/TestWizard';

/**
 * Application router configuration.
 *
 * Public routes: login, OTP verify (wrapped in AuthLayout)
 * Protected routes: dashboard, profile, onboarding (wrapped in AuthGuard + AppLayout)
 * Admin routes: /admin/* (wrapped in AdminGuard + AdminLayout)
 */
export const router = createBrowserRouter([
  // Public routes (auth screens)
  {
    path: '/login',
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },
  {
    path: '/auth/google/callback',
    element: (
      <AuthLayout>
        <GoogleCallbackPage />
      </AuthLayout>
    ),
  },
  {
    path: '/verify-otp',
    element: (
      <AuthLayout>
        <OTPVerifyPage />
      </AuthLayout>
    ),
  },

  // Protected routes (require authentication)
  {
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/profile',
        element: <ProfileSettingsPage />,
      },
      {
        path: '/study-plan',
        element: <StudyPlanPage />,
      },
      {
        path: '/study-plan/subject/:subjectId',
        element: <SubjectDetailPage />,
      },
      {
        path: '/study-plan/topic/:topicId',
        element: <TopicDetailPage />,
      },
      {
        path: '/progress',
        element: <ProgressPage />,
      },
      {
        path: '/community',
        element: <CommunityPage />,
      },
      {
        path: '/daily-challenge',
        element: <DailyChallengePage />,
      },
      {
        path: '/community',
        element: <DashboardPage />, // Placeholder — will be its own page later
      },
      {
        path: '/tests',
        element: <TestListPage />,
      },
      {
        path: '/tests/my-results',
        element: <MyResultsPage />,
      },
      {
        path: '/tests/:testId/attempt',
        element: <TestAttemptPage />,
      },
      {
        path: '/tests/:testId/results/:attemptId',
        element: <TestResultsPage />,
      },
      {
        path: '/tests/:testId/review/:attemptId',
        element: <AnswerReviewPage />,
      },
    ],
  },

  // Onboarding (protected but with its own layout)
  {
    path: '/onboarding',
    element: (
      <AuthGuard>
        <AuthLayout>
          <OnboardingPage />
        </AuthLayout>
      </AuthGuard>
    ),
  },

  // Admin routes (require admin or super_admin role)
  {
    element: (
      <AdminGuard>
        <AdminLayout />
      </AdminGuard>
    ),
    children: [
      { path: '/admin/dashboard', element: <AdminDashboard /> },
      { path: '/admin/questions', element: <AdminQuestions /> },
      { path: '/admin/questions/new', element: <QuestionEditor /> },
      { path: '/admin/questions/:id/edit', element: <QuestionEditor /> },
      { path: '/admin/tests', element: <AdminTests /> },
      { path: '/admin/tests/new', element: <TestWizard /> },
      { path: '/admin/tests/:id/edit', element: <TestWizard /> },
      { path: '/admin/users', element: <AdminUsers /> },
      { path: '/admin/users/:id', element: <AdminUserDetail /> },
      { path: '/admin/exams', element: <AdminExams /> },
      { path: '/admin/subjects', element: <AdminSubjects /> },
      { path: '/admin/import', element: <AdminImport /> },
      { path: '/admin/activity', element: <AdminActivity /> },
    ],
  },

  // Admin redirect
  {
    path: '/admin',
    element: <Navigate to="/admin/dashboard" replace />,
  },

  // Landing page for first-time visitors (signed-in users are sent on to /dashboard)
  {
    path: '/',
    element: <LandingPage />,
  },

  // Catch-all - redirect to dashboard (AuthGuard will handle unauthenticated)
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
