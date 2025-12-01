/**
 * Gizmo API Response Types
 *
 * These types represent the actual API response structures from Gizmo POS system.
 * IMPORTANT: When updating products, ALL fields must be sent - partial updates are NOT supported.
 */

// Base API Response wrapper
export interface GizmoApiResponse<T> {
  result: T;
  httpStatusCode: number;
  isError: boolean;
  errorMessage?: string;
}

// Paginated response wrapper
export interface GizmoPaginatedResponse<T> {
  result: {
    data: T[];
    totalCount?: number;
  };
  httpStatusCode: number;
  isError: boolean;
}

// Raw product from API (before transformation)
export interface GizmoRawProduct {
  id: number;
  productType: number;
  guid: string;
  productImages: GizmoProductImage[] | null;
  productGroupId: number | null;
  name: string | null;
  price: number | null;
  cost: number | null;
  barcode: string | null;
  stockProductAmount: number | null;
  isDeleted: boolean;
}

export interface GizmoProductImage {
  id: number;
  imageUrl: string;
  isMain: boolean;
}

// Raw product group from API
export interface GizmoRawProductGroup {
  id: number;
  name: string | null;
  description: string | null;
  displayOrder: number;
  isDeleted: boolean;
}

/**
 * Product Update Payload
 *
 * CRITICAL: Gizmo API requires ALL these fields when updating a product.
 * You CANNOT send partial updates (e.g., just { id, price }).
 *
 * Correct flow:
 * 1. GET /api/v2.0/products/{id} - fetch current product data
 * 2. Modify the field(s) you want to change
 * 3. PUT /api/v2.0/products - send complete product object
 *
 * Missing required fields will cause:
 * - API errors (400 Bad Request)
 * - Data corruption (fields set to null/default)
 */
export interface GizmoProductUpdatePayload {
  /** Product ID (required) */
  id: number;

  /** Product type - usually 0 for standard products (required) */
  productType: number;

  /** Unique identifier GUID (required) */
  guid: string;

  /** Product images array (required, can be empty array) */
  productImages: GizmoProductImage[];

  /** Category/group ID (required) */
  productGroupId: number;

  /** Product name (required) */
  name: string;

  /** Selling price (required) */
  price: number;

  /** Cost/purchase price (required) */
  cost: number;

  /** Barcode (required) */
  barcode: string;

  /** Soft delete flag (optional, defaults to false) */
  isDeleted?: boolean;
}

// Stock update doesn't need a payload - it's URL-based
// POST /api/stock/{productId}/{newStockCount}

// API Endpoints documentation
export const GIZMO_API_ENDPOINTS = {
  /** GET - Fetch all products with pagination */
  PRODUCTS: '/v2.0/products',

  /** GET - Fetch single product by ID */
  PRODUCT_BY_ID: (id: string | number) => `/v2.0/products/${id}`,

  /** GET - Fetch product images */
  PRODUCT_IMAGES: (id: string | number) => `/v2.0/products/${id}/images`,

  /** PUT - Update product (requires full payload) */
  UPDATE_PRODUCT: '/v2.0/products',

  /** GET - Fetch all product groups */
  PRODUCT_GROUPS: '/v2.0/productgroups',

  /** POST - Update stock count (no body needed) */
  UPDATE_STOCK: (productId: string | number, newCount: number) =>
    `/stock/${productId}/${newCount}`,
} as const;

// Type guards for runtime validation
export function isGizmoRawProduct(value: unknown): value is GizmoRawProduct {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'number' &&
    typeof obj.productType === 'number' &&
    typeof obj.guid === 'string'
  );
}

export function isGizmoRawProductGroup(value: unknown): value is GizmoRawProductGroup {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === 'number' && typeof obj.isDeleted === 'boolean';
}

/**
 * Validates that a product update payload has all required fields.
 * Use this before sending PUT requests to avoid API errors.
 */
export function validateProductUpdatePayload(
  payload: unknown
): payload is GizmoProductUpdatePayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const obj = payload as Record<string, unknown>;

  const requiredFields: Array<keyof GizmoProductUpdatePayload> = [
    'id',
    'productType',
    'guid',
    'productImages',
    'productGroupId',
    'name',
    'price',
    'cost',
    'barcode',
  ];

  for (const field of requiredFields) {
    if (!(field in obj)) {
      console.error(`Missing required field for product update: ${field}`);
      return false;
    }
  }

  return true;
}

/**
 * Creates a product update payload from GET response.
 * Ensures all required fields are present.
 */
export function createProductUpdatePayload(
  product: GizmoRawProduct,
  updates: Partial<Pick<GizmoProductUpdatePayload, 'price' | 'cost' | 'barcode' | 'name' | 'isDeleted'>>
): GizmoProductUpdatePayload {
  return {
    id: product.id,
    productType: product.productType,
    guid: product.guid,
    productImages: product.productImages ?? [],
    productGroupId: product.productGroupId ?? 0,
    name: updates.name ?? product.name ?? '',
    price: updates.price ?? product.price ?? 0,
    cost: updates.cost ?? product.cost ?? 0,
    barcode: updates.barcode ?? product.barcode ?? '',
    isDeleted: updates.isDeleted ?? product.isDeleted,
  };
}
