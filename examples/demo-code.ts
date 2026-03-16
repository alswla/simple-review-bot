/**
 * Order processing service
 */

interface Order {
  id: string;
  userId: string;
  items: { productId: string; quantity: number; price: number }[];
  status: 'pending' | 'confirmed' | 'shipped';
  createdAt: Date;
}

// N+1 query pattern
export async function getOrdersWithProducts(db: any) {
  const orders = await db.query('SELECT * FROM orders WHERE status = "pending"');
  
  for (const order of orders) {
    order.products = await db.query(
      `SELECT * FROM products WHERE id IN (${order.item_ids.join(',')})`,
    );
  }
  
  return orders;
}

// Race condition in concurrent updates
export async function updateInventory(
  db: any,
  productId: string,
  quantity: number,
) {
  const product = await db.query(
    'SELECT stock FROM products WHERE id = ?',
    [productId],
  );
  
  if (product.stock >= quantity) {
    await db.query(
      'UPDATE products SET stock = stock - ? WHERE id = ?',
      [quantity, productId],
    );
    return true;
  }
  return false;
}

// Missing pagination, loads all data
export async function getUserOrderHistory(db: any, userId: string) {
  const orders = await db.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  
  const result = orders.map((order: Order) => ({
    ...order,
    totalPrice: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    itemCount: order.items.length,
  }));
  
  return result;
}

// Floating point calculation for money
export function calculateDiscount(price: number, discountPercent: number): number {
  return price - (price * discountPercent / 100);
}

export function calculateOrderTotal(items: { price: number; quantity: number }[]) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}
