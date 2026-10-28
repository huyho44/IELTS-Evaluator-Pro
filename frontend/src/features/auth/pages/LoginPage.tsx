import LoginForm from "../components/LoginForm";
import AuthLayout from "../components/AuthLayout";
export default function LoginPage() {
  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back! Please enter your details."
    >
      <LoginForm />
    </AuthLayout>
  );
}
