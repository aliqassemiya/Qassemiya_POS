import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { productSchema, type ProductInput } from "@qassemiya/shared-types";
import { listVendors } from "@/api/vendors";
import { addVariant, createProduct, getProduct, updateProduct, updateVariant } from "@/api/products";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";
import { SIZE_CODES } from "@/lib/sizeCodes";

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
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canManage = useHasPermission("catalog.manage");

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

  // Size-based variant generator — base SKU + a picked size's fixed 2-digit
  // code = the full variant SKU (e.g. base "1612345" + size "36" (code
  // "36") = "161234536"), matching the store's printed size chart. Barcode
  // is set to the same value as the generated SKU (also globally unique,
  // since sku itself is @unique), and cost/selling price/color are shared
  // across every size generated in the same batch — sizes of the same style
  // are priced and colored identically, only the SKU/barcode/size differ
  // per row.
  const [baseSku, setBaseSku] = useState("");
  const [genCostPrice, setGenCostPrice] = useState("");
  const [genSellingPrice, setGenSellingPrice] = useState("");
  const [genColor, setGenColor] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const watchedVariants = watch("variants");

  function toggleSize(label: string) {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function handleGenerateVariants() {
    const trimmedBase = baseSku.trim();
    if (!trimmedBase) {
      toast.error(t("products.form.generateMissingBaseSkuError"));
      return;
    }
    if (selectedSizes.size === 0) {
      toast.error(t("products.form.generateNoSizesError"));
      return;
    }

    const currentVariants = watchedVariants ?? [];
    const existingSkus = new Set(currentVariants.map((v) => v.sku).filter(Boolean));
    const costPrice = Number(genCostPrice) || 0;
    const sellingPrice = Number(genSellingPrice) || 0;
    const toAdd = SIZE_CODES.filter((s) => selectedSizes.has(s.label))
      .map((s) => {
        const sku = `${trimmedBase}${s.code}`;
        return { ...emptyVariant, sku, barcode: sku, size: s.label, color: genColor, costPrice, sellingPrice };
      })
      .filter((v) => !existingSkus.has(v.sku));

    if (toAdd.length === 0) {
      toast.error(t("products.form.generateAllExistError"));
      return;
    }

    // A brand-new product starts with one blank placeholder row — replace
    // it instead of leaving an untouched, invalid empty-SKU row behind once
    // real generated variants exist.
    if (!isEdit && currentVariants.length === 1) {
      const only = currentVariants[0];
      if (!only.sku && !only.costPrice && !only.sellingPrice) {
        remove(0);
        setVariantIds([]);
      }
    }

    toAdd.forEach((v) => {
      append(v);
      setVariantIds((prev) => [...prev, undefined]);
    });
    setSelectedSizes(new Set());
    toast.success(t("products.form.generatedToast", { count: toAdd.length }));
  }

  const createProductMutation = useMutation({
    mutationFn: (input: ProductInput) => createProduct({ ...input, vendorId: vendorId || undefined } as ProductInput),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate(`/products/${product.id}`);
      toast.success(t("products.form.createdToast"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("products.form.createFailedToast"))),
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
      toast.success(t("products.form.savedToast"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("products.form.saveFailedToast"))),
  });

  const onSubmit = (input: ProductInput) => {
    // barcode is a unique DB column — an empty string is still a value, not
    // "no barcode", so saving two-plus variants left blank (common when
    // bulk-generating by size) would collide on that "" the moment a second
    // one is submitted. Normalize blank to undefined so Prisma stores NULL,
    // which the unique constraint allows any number of.
    const normalized: ProductInput = {
      ...input,
      variants: input.variants.map((v) => ({ ...v, barcode: v.barcode ? v.barcode : undefined })),
    };
    if (isEdit) {
      updateProductMutation.mutate(normalized);
    } else {
      createProductMutation.mutate(normalized);
    }
  };

  const formBody = (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">
        {isEdit ? t("products.form.editTitle") : t("products.form.newTitle")}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <fieldset
          disabled={!canManage}
          className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <TextField label={t("common.name")} error={errors.name} {...register("name")} />
          <TextField label={t("products.form.nameArabicLabel")} error={errors.nameAr} {...register("nameAr")} />
          <TextField label={t("products.form.brandLabel")} error={errors.brand} {...register("brand")} />
          {/* Vendor is a product-level tag, not per-variant — a whole style is
              sourced from one supplier even with many size/color variants,
              per Part A of the plan. Controlled outside react-hook-form; see
              the vendorId state/effect above for why. */}
          <SelectField label={t("products.form.vendorLabel")} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">{t("products.form.noneOption")}</option>
            {vendorsQuery.data?.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.code} — {vendor.name}
              </option>
            ))}
          </SelectField>
          <div className="sm:col-span-2">
            <TextField label={t("products.form.descriptionLabel")} error={errors.description} {...register("description")} />
          </div>
          {/* One image per product/style, not per-variant — these are
              dresses, a single garment shot covers every size/color. */}
          <div className="sm:col-span-2 flex items-end gap-3">
            <div className="flex-1">
              <TextField
                label={t("products.form.imageUrlLabel")}
                placeholder={t("products.form.imageUrlPlaceholder")}
                error={errors.imageUrl}
                {...register("imageUrl")}
              />
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

        {canManage && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="w-full sm:w-56">
                <TextField
                  label={t("products.form.baseSkuLabel")}
                  placeholder={t("products.form.baseSkuPlaceholder")}
                  value={baseSku}
                  onChange={(e) => setBaseSku(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-40">
                <TextField
                  label={t("products.form.colorLabel")}
                  value={genColor}
                  onChange={(e) => setGenColor(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-40">
                <TextField
                  label={t("products.form.costPriceLabel")}
                  type="number"
                  step="0.01"
                  value={genCostPrice}
                  onChange={(e) => setGenCostPrice(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-40">
                <TextField
                  label={t("products.form.sellingPriceLabel")}
                  type="number"
                  step="0.01"
                  value={genSellingPrice}
                  onChange={(e) => setGenSellingPrice(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" onClick={handleGenerateVariants}>
                {t("products.form.generateVariantsButton")}
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t("products.form.baseSkuHint")}</p>

            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-slate-600">{t("products.form.sizesLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {SIZE_CODES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => toggleSize(s.label)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedSizes.has(s.label)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{t("products.form.variantsTitle")}</h2>
            {canManage && (
              <Button type="button" variant="secondary" onClick={handleAppendVariant}>
                {t("products.form.addVariantButton")}
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
                  label={t("products.form.skuLabel")}
                  error={errors.variants?.[index]?.sku}
                  {...register(`variants.${index}.sku` as const)}
                />
                <TextField
                  label={t("products.form.barcodeLabel")}
                  error={errors.variants?.[index]?.barcode}
                  {...register(`variants.${index}.barcode` as const)}
                />
                <TextField
                  label={t("products.form.sizeLabel")}
                  error={errors.variants?.[index]?.size}
                  {...register(`variants.${index}.size` as const)}
                />
                <TextField
                  label={t("products.form.colorLabel")}
                  error={errors.variants?.[index]?.color}
                  {...register(`variants.${index}.color` as const)}
                />
                <TextField
                  label={t("products.form.costPriceLabel")}
                  type="number"
                  step="0.01"
                  error={errors.variants?.[index]?.costPrice}
                  {...register(`variants.${index}.costPrice` as const, { valueAsNumber: true })}
                />
                <TextField
                  label={t("products.form.sellingPriceLabel")}
                  type="number"
                  step="0.01"
                  error={errors.variants?.[index]?.sellingPrice}
                  {...register(`variants.${index}.sellingPrice` as const, { valueAsNumber: true })}
                />
                <TextField
                  label={t("products.form.taxRateLabel")}
                  type="number"
                  step="0.01"
                  error={errors.variants?.[index]?.taxRate}
                  {...register(`variants.${index}.taxRate` as const, { valueAsNumber: true })}
                />
                {canManage && fields.length > 1 && (
                  <div className="col-span-full text-right">
                    <Button type="button" variant="ghost" onClick={() => handleRemoveVariant(index)}>
                      {t("products.form.removeVariantButton")}
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
              {t("products.form.saveButton")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => reset()}>
              {t("products.form.resetButton")}
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
