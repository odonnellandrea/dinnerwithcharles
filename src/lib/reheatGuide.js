// Builds the reheat guide for one customer's delivery: the dishes they ordered, in order,
// each with its reheat steps. Shared by the guide page and the PDF download.
//   orders:        the customer's Orders rows for the delivery date
//   sheetSteps:    fetchSheetReheat() result (dish name, lowercased -> [{ name, instruction }])
//   lookupLibrary: async (itemType, itemName) -> item row from the old dish library, or null
export async function buildReheatGuide({ orders, sheetSteps = {}, lookupLibrary }) {
  const dishes = []
  const seen = new Set()
  for (const o of orders || []) {
    if (seen.has(o.item_name)) continue
    seen.add(o.item_name)
    let components = sheetSteps[String(o.item_name).toLowerCase()] || []
    if (!components.length && lookupLibrary) {
      // Dishes from before the sheet existed live in the item library
      const item = await lookupLibrary(o.item_type, o.item_name).catch(() => null)
      if (item?.components) components = item.components.map(c => ({ name: c.name, instruction: c.instruction }))
    }
    dishes.push({ name: o.item_name, type: o.item_type, components })
  }
  return dishes
}

export const LIBRARY_TABLE = { entree: 'entrees', salad: 'salads', addon: 'add_ons' }
