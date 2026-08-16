import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { productSchema, type ProductInput } from "@qassemiya/shared-types";
import { listCategories } from "@/api/categories";
import { listVendors } from "@/api/vendors";
import { addVariant, createProduct, getProduct, updateProduct, updateVariant } from "@/api/products";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useHasPermission } from "@/hooks/useHasPermission";

const emptyVariant: ProductInput["variants"][number] = {
  sku: "",
  barcode: "",
  barcodeType: "CODE128",
  size: "",
  color: "",
  colorHex: "",
  costPrice: 0,
  sellingPrice: 0,
  taxRate: 15,
};

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canManage = useHasPermission("catalog.manage");

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });
  const productQuery = useQuery({
    queryKey: ["products", id],
    queryFn: () => getProduct(id as string),
    enabled: isEdit,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", variants: [emptyVariant] },
    values: productQuery.data
      ? {
          name: productQuery.data.name,
          nameAr: productQuery.data.nameAr ?? undefined,
          description: productQuery.data.description ?? undefined,
          categoryId: productQuery.data.categoryId ?? undefined,
          brand: productQuery.data.brand ?? undefined,
          imageUrl: productQuery.data.imageUrl ?? undefined,
          variants: productQuery.data.variants.map((v) => ({
            sku: v.sku,
            barcode: v.barcode ?? undefined,
            barcodeType: v.barcodeType,
            size: v.size ?? undefined,
            color: v.color ?? undefined,
            colorHex: v.colorHex ?? undefined,
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice,
            compareAtPrice: v.compareAtPrice ?? undefined,
            taxRate: v.taxRate,
            reorderPoint: v.reorderPoint ?? undefined,
          })),
        }
      : undefined,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  // zodResolver strips any field not declared in productVariantSchema, so a
  // variant's real entity id can't be smuggled through form values — it's
  // tracked here instead, kept index-aligned with `fields`, so submit can
  // tell "update existing variant" apart from "add new variant".
  const [variantIds, setVariantIds] = useState<(string | undefined)[]>([]);
  useEffect(() => {
    if (productQuery.data) {
      setVariantIds(productQuery.data.variants.map((v) => v.id));
    }
  }, [productQuery.data]);

  // "Primary vendor" tag — product-level (not per-variant), per Part A of
  // the plan. @qassemiya/shared-types' productSchema doesn't declare a
  // vendorId field yet (that lands with the parallel apps/api build), and
  // zodResolver strips any field not declared in the schema — so, exactly
  // like variantIds above, it's tracked outside the RHF-managed form state
  // and merged into the payload on submit instead of being `register()`-ed.
  const [vendorId, setVendorId] = useState<string>("");
  useEffect(() => {
    setVendorId(productQuery.data?.vendorId ?? "");
  }, [productQuery.data]);

  const handleAppendVariant = () => {
    append(emptyVariant);
    setVariantIds((prev) => [...prev, undefined]);
  };
  const handleRemoveVariant = (index: number) => {
    remove(index);
    setVariantIds((prev) => prev.filter((_, i) => i !== index));
  };

  const createProductMutation = useMutation({
    mutationFn: (input: ProductInput) => createProduct({ ...input, vendorId: vendorId || undefined } as ProductInput),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate(`/products/${product.id}`);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (input: ProductInput) => {
      if (!id) return;
      const { variants, ...productFields } = input;
      await updateProduct(id, { ...productFields, vendorId: vendorId || undefined } as Partial<ProductInput>);
      await Promise.all(
        variants.map((variant, index) => {
          const variantId = variantIds[index];
          return variantId ? updateVariant(variantId, variant) : addVariant(id, variant);
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate(`/products/${id}`);
    },
  });

  const onSubmit = (input: ProductInput) => {
    if (isEdit) {
      updateProductMutation.mutate(input);
    } else {
      createProductMutation.mutate(input);
    }
  };

  const formBody = (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? "Edit product" : "New product"}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <fieldset
          disabled={!canManage}
          className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <TextField label="Name" error={errors.name} {...register("name")} />
          <TextField label="Name (Arabic)" error={errors.nameAr} {...register("nameAr")} />
          <TextField label="Brand" error={errors.brand} {...register("brand")} />
          <SelectField label="Category" error={errors.categoryId} {...register("categoryId")}>
            <option value="">None</option>
            {categoriesQuery.data?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </SelectField>
          {/* Vendor is a product-level tag, not per-variant — a whole style is
              sourced from one supplier even with many size/color variants,
              per Part A of the plan. Controlled outside react-hook-form; see
              the vendorId state/effect above for why. */}
          <SelectField label="Vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">None</option>
            {vendorsQuery.data?.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.code} — {vendor.name}
              </option>
            ))}
          </SelectField>
          <div className="sm:col-span-2">
            <TextField label="Description" error={errors.description} {...register("description")} />
          </div>
          {/* One image per product/style, not per-variant — these are
              dresses, a single garment shot covers every size/color. */}
          <div className="sm:col-span-2 flex items-end gap-3">
            <div className="flex-1">
              <TextField label="Image URL" placeholder="https://…" error={errors.imageUrl} {...register("imageUrl")} />
            </div>
            {watch("imageUrl") && (
              <img
                src={watch("imageUrl")}
                alt=""
                className="h-16 w-16 rounded-md border border-slate-200 object-cover"
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
            )}
          </div>
        </fieldset>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Variants</h2>
            {canManage && (
              <Button type="button" variant="secondary" onClick={handleAppendVariant}>
                Add variant
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
              <fieldset
                key={field.id}
                disabled={!canManage}
                className="grid grid-cols-2 gap-3 rounded-md border border-slate-100 p-3 sm:grid-cols-4"
              >
                <TextField
                  label="SKU"
                  error={errors.variants?.[index]?.sku}
                  {...register(`variants.${index}.sku` as const)}
                />
                <TextField
                  label="Barcode"
                  error={errors.variants?.[index]?.barcode}
                  {...register(`variants.${index}.barcode` as const)}
                />
                <TextField
                  label="Size"
                  error={errors.variants?.[index]?.size}
                  {...register(`variants.${index}.size` as const)}
                />
                <TextField
                  label="Color"
                  error={errors.variants?.[index]?.color}
                  {...register(`variants.${index}.color` as const)}
                />
                <TextField
                  label="Cost price"
                  type="number"
                  step="0.01"
                  error={errors.variants?.[index]?.costPrice}
                  {...register(`variants.${index}.costPrice` as const, { valueAsNumber: true })}
                />
                <TextField
                  label="Selling price"
                  type="number"
                  step="0.01"
                  error={errors.variants?.[index]?.sellingPrice}
                  {...register(`variants.${index}.sellingPrice` as const, { valueAsNumber: true })}
                />
                <TextField
                  label="Tax rate %"
                  type="number"
                  step="0.01"
                  error={errors.variants?.[index]?.taxRate}
                  {...register(`variants.${index}.taxRate` as const, { valueAsNumber: true })}
                />
                <TextField
                  label="Reorder point"
                  type="number"
                  error={errors.variants?.[index]?.reorderPoint}
                  {...register(`variants.${index}.reorderPoint` as const, { valueAsNumber: true })}
                />
                {canManage && fields.length > 1 && (
                  <div className="col-span-full text-right">
                    <Button type="button" variant="ghost" onClick={() => handleRemoveVariant(index)}>
                      Remove variant
                    </Button>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="flex gap-3">
            <Button
              type="submit"
              isLoading={isSubmitting || createProductMutation.isPending || updateProductMutation.isPending}
            >
              Save product
            </Button>
            <Button type="button" variant="secondary" onClick={() => reset()}>
              Reset
            </Button>
          </div>
        )}
      </form>
    </div>
  );

  if (isEdit) {
    return (
      <DataState isLoading={productQuery.isLoading} isError={productQuery.isError} error={productQuery.error}>
        {formBody}
      </DataState>
    );
  }

  return formBody;
}
