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
  Textarea,
  Select,
  SelectItem,
  Switch,
  Button,
} from "@heroui/react";
import { toast } from "sonner";

import { trainingService } from "@/services/training";
import type { AddonCourse } from "@/types";
import { CATEGORY_OPTIONS, LEVEL_OPTIONS } from "../constants";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  coverUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  category: z.enum(["security", "compliance", "skills", "safety", "other"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  pointsValue: z.number().int().min(0, "Must be 0 or more"),
  passingScore: z.number().int().min(0).max(100, "0–100"),
  addonPrice: z.number().min(0).optional(),
  published: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function CreateAddonCourseModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (course: AddonCourse) => void;
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
      title: "",
      description: "",
      coverUrl: "",
      category: "security",
      level: "beginner",
      pointsValue: 0,
      passingScore: 70,
      addonPrice: undefined,
      published: false,
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  const published = watch("published");

  const onSubmit = handleSubmit(async (values) => {
    try {
      const course = await trainingService.createCourse({
        title: values.title,
        description: values.description?.trim() || null,
        coverUrl: values.coverUrl?.trim() || null,
        category: values.category,
        level: values.level,
        pointsValue: values.pointsValue,
        passingScore: values.passingScore,
        addonPrice:
          values.addonPrice != null && !Number.isNaN(values.addonPrice)
            ? values.addonPrice
            : null,
        published: !!published,
      });
      toast.success(`Addon course “${course.title}” created`);
      reset();
      onCreated(course);
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
            <span className="text-lg font-semibold">New addon course</span>
            <span className="text-sm font-normal text-default-500">
              A platform-wide training course you can grant or sell to tenants.
            </span>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Title"
                isRequired
                variant="bordered"
                className="sm:col-span-2"
                {...register("title")}
                isInvalid={!!errors.title}
                errorMessage={errors.title?.message}
              />
              <Textarea
                label="Description"
                variant="bordered"
                className="sm:col-span-2"
                minRows={2}
                {...register("description")}
                isInvalid={!!errors.description}
                errorMessage={errors.description?.message}
              />
              <Input
                label="Cover image URL"
                variant="bordered"
                className="sm:col-span-2"
                placeholder="https://…"
                {...register("coverUrl")}
                isInvalid={!!errors.coverUrl}
                errorMessage={errors.coverUrl?.message}
              />
              <Select
                label="Category"
                isRequired
                variant="bordered"
                selectedKeys={[watch("category")]}
                onChange={(e) =>
                  setValue("category", e.target.value as FormValues["category"], {
                    shouldValidate: true,
                  })
                }
                isInvalid={!!errors.category}
                errorMessage={errors.category?.message}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Level"
                isRequired
                variant="bordered"
                selectedKeys={[watch("level")]}
                onChange={(e) =>
                  setValue("level", e.target.value as FormValues["level"], {
                    shouldValidate: true,
                  })
                }
                isInvalid={!!errors.level}
                errorMessage={errors.level?.message}
              >
                {LEVEL_OPTIONS.map((o) => (
                  <SelectItem key={o.key}>{o.label}</SelectItem>
                ))}
              </Select>
              <Input
                label="Points value"
                type="number"
                min={0}
                variant="bordered"
                {...register("pointsValue", { valueAsNumber: true })}
                isInvalid={!!errors.pointsValue}
                errorMessage={errors.pointsValue?.message}
              />
              <Input
                label="Passing score (%)"
                type="number"
                min={0}
                max={100}
                variant="bordered"
                {...register("passingScore", { valueAsNumber: true })}
                isInvalid={!!errors.passingScore}
                errorMessage={errors.passingScore?.message}
              />
              <Input
                label="Addon price (USD)"
                type="number"
                min={0}
                step="0.01"
                variant="bordered"
                placeholder="Leave blank for free"
                {...register("addonPrice", {
                  setValueAs: (v) =>
                    v === "" || v == null ? undefined : Number(v),
                })}
                isInvalid={!!errors.addonPrice}
                errorMessage={errors.addonPrice?.message}
              />
              <div className="flex items-center sm:col-span-2">
                <Switch
                  isSelected={!!published}
                  onValueChange={(v) =>
                    setValue("published", v, { shouldValidate: false })
                  }
                >
                  <span className="text-sm">Published (visible in catalog)</span>
                </Switch>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={close} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={isSubmitting}>
              Create course
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

export default CreateAddonCourseModal;
