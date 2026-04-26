import { LeftSide } from "@/components/auth/left-side";
import { RightSide } from "@/components/auth/right-side";

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex w-full max-w-6xl overflow-hidden">
        {/* Left Side */}
        <LeftSide />

        {/* Right Side */}
        <RightSide />
      </div>
    </div>
  );
};

export default Login;
