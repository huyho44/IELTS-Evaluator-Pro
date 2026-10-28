import RegisterForm from "../components/RegisterForm";
import AuthLayout from "../components/AuthLayout";
export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create an account"
      description="Enter your details to create a learner account."
      register
    >
      <RegisterForm />
    </AuthLayout>
  );
}
