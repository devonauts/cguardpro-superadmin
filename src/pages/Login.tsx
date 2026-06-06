import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardBody, Input, Button } from "@heroui/react";
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await signIn(email, password);
      // Redirect is automatic via PublicOnlyRoute; navigate as a safety net.
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err?.code === "NOT_SUPERADMIN") {
        const msg = "This account does not have SuperAdmin access.";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      const msg = err?.message || "Sign in failed. Please try again.";
      setFormError(msg);
      toast.error(msg);
    }
  });

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-default-100 p-4">
      {/* Ambient glow accents */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border border-default-200/60 bg-content1/80 shadow-2xl backdrop-blur">
        <CardBody className="gap-6 p-8">
          {/* Brand wordmark */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                CGuard Pro
              </h1>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                SuperAdmin
              </p>
            </div>
          </div>

          {/* Restricted note */}
          <div className="flex items-center gap-2 rounded-lg border border-default-200/60 bg-default-100/50 px-3 py-2 text-xs text-default-500">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>Restricted — platform administrators only.</span>
          </div>

          {/* Inline error alert */}
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              {...register("email")}
              type="email"
              label="Email"
              placeholder="you@cguard.pro"
              variant="bordered"
              autoComplete="username"
              autoFocus
              isInvalid={!!errors.email}
              errorMessage={errors.email?.message}
              startContent={<Mail className="h-4 w-4 text-default-400" />}
            />

            <Input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              label="Password"
              placeholder="••••••••"
              variant="bordered"
              autoComplete="current-password"
              isInvalid={!!errors.password}
              errorMessage={errors.password?.message}
              startContent={<Lock className="h-4 w-4 text-default-400" />}
              endContent={
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-default-400 outline-none transition-colors hover:text-default-600 focus-visible:text-primary"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />

            <Button
              type="submit"
              color="primary"
              size="lg"
              className="mt-2 font-medium"
              isLoading={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
