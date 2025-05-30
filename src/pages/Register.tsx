import React from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";

const Register = () => {
  const handleGoogleSignup = async () => {
    // TODO: Implement Google OAuth integration when ready
    console.log("Google signup clicked");
  };

  return <RegisterForm onGoogleSignup={handleGoogleSignup} />;
};

export default Register;
