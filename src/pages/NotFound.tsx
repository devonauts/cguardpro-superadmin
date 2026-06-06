import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-default-100 p-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
          <Compass className="h-8 w-8 text-primary" />
        </div>

        <div>
          <p className="text-7xl font-bold tracking-tight text-foreground">404</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Page not found
          </h1>
          <p className="mt-2 max-w-sm text-sm text-default-500">
            The page you’re looking for doesn’t exist or may have been moved.
          </p>
        </div>

        <Button
          color="primary"
          variant="solid"
          size="lg"
          startContent={<ArrowLeft className="h-4 w-4" />}
          onPress={() => navigate("/")}
          className="font-medium"
        >
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
