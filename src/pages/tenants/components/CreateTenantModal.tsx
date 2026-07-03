import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  SelectItem,
  Button,
} from "@heroui/react";
import { toast } from "sonner";
import { tenantsService } from "@/services/tenants";
import type { TenantDetail } from "@/types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().min(1, "Email is required").email("Invalid email"),
  phone: z.string().trim().min(1, "Phone is required"),
  address: z.string().trim().min(1, "Address is required"),
  taxNumber: z.string().trim().min(1, "Tax number is required"),
  businessTitle: z.string().trim().min(1, "Business title is required"),
  plan: z.enum(["free", "growth", "enterprise"]),
  timezone: z.string().trim().min(1, "Timezone is required"),
  // Optional owner invite — provisions the tenant's first admin + invite email.
  ownerEmail: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  ownerFirstName: z.string().trim().optional(),
  ownerLastName: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

const PLANS = [
  { key: "free", label: "Free" },
  { key: "growth", label: "Growth" },
  { key: "enterprise", label: "Enterprise" },
];

export function CreateTenantModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (tenant: TenantDetail) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      taxNumber: "",
      businessTitle: "",
      plan: "free",
      timezone: "UTC",
      ownerEmail: "",
      ownerFirstName: "",
      ownerLastName: "",
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { ownerEmail, ownerFirstName, ownerLastName, ...tenantFields } = values;
      const body: Record<string, any> = { ...tenantFields };
      if (ownerEmail && ownerEmail.trim()) {
        body.owner = {
          email: ownerEmail.trim(),
          firstName: ownerFirstName?.trim() || null,
          lastName: ownerLastName?.trim() || null,
        };
      }
      const tenant = await tenantsService.create(body);
      toast.success(
        body.owner
          ? `Tenant “${tenant.name}” created · invite sent to ${body.owner.email}`
          : `Tenant “${tenant.name}” created`,
      );
      reset();
      onCreated(tenant);
    } catch {
      // error toast handled by api interceptor
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="2xl"
      scrollBehavior="inside"
      isDismissable={!isSubmitting}
    >
      <ModalContent>
        <form onSubmit={onSubmit}>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-lg font-semibold">New tenant</span>
            <span className="text-sm font-normal text-default-500">
              Create a new organization. A trial begins automatically.
            </span>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                isRequired
                variant="bordered"
                {...register("name")}
                isInvalid={!!errors.name}
                errorMessage={errors.name?.message}
              />
              <Input
                label="Business title"
                isRequired
                variant="bordered"
                {...register("businessTitle")}
                isInvalid={!!errors.businessTitle}
                errorMessage={errors.businessTitle?.message}
              />
              <Input
                label="Email"
                type="email"
                isRequired
                variant="bordered"
                {...register("email")}
                isInvalid={!!errors.email}
                errorMessage={errors.email?.message}
              />
              <Input
                label="Phone"
                isRequired
                variant="bordered"
                {...register("phone")}
                isInvalid={!!errors.phone}
                errorMessage={errors.phone?.message}
              />
              <Input
                label="Address"
                isRequired
                variant="bordered"
                className="sm:col-span-2"
                {...register("address")}
                isInvalid={!!errors.address}
                errorMessage={errors.address?.message}
              />
              <Input
                label="Tax number"
                isRequired
                variant="bordered"
                {...register("taxNumber")}
                isInvalid={!!errors.taxNumber}
                errorMessage={errors.taxNumber?.message}
              />
              <Input
                label="Timezone"
                isRequired
                variant="bordered"
                {...register("timezone")}
                isInvalid={!!errors.timezone}
                errorMessage={errors.timezone?.message}
              />
              <Select
                label="Plan"
                isRequired
                variant="bordered"
                className="sm:col-span-2"
                selectedKeys={[watch("plan")]}
                onChange={(e) =>
                  setValue("plan", e.target.value as FormValues["plan"], {
                    shouldValidate: true,
                  })
                }
                isInvalid={!!errors.plan}
                errorMessage={errors.plan?.message}
              >
                {PLANS.map((p) => (
                  <SelectItem key={p.key}>{p.label}</SelectItem>
                ))}
              </Select>
            </div>

            {/* ── Optional owner invite ── */}
            <div className="mt-2 rounded-lg border border-default-200 p-4">
              <div className="mb-1 text-sm font-medium text-foreground">
                Owner (optional)
              </div>
              <p className="mb-3 text-xs text-default-500">
                Provide an email to provision the tenant’s first admin and send
                an invitation to set a password. Leave blank to skip.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Owner email"
                  type="email"
                  variant="bordered"
                  className="sm:col-span-2"
                  {...register("ownerEmail")}
                  isInvalid={!!errors.ownerEmail}
                  errorMessage={errors.ownerEmail?.message}
                />
                <Input
                  label="Owner first name"
                  variant="bordered"
                  {...register("ownerFirstName")}
                />
                <Input
                  label="Owner last name"
                  variant="bordered"
                  {...register("ownerLastName")}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={close} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={isSubmitting}>
              Create tenant
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

export default CreateTenantModal;
