/**
 * HyMotion — structured running-cost categories (mirrors GMS.Core.Constants.CashExpenseCatalog).
 */
(function (global) {
  'use strict';

  var TYPES_BY_CATEGORY = {
    Utilities: ['Electricity', 'Water', 'Gas', 'Internet', 'Telephone'],
    'Rent & Property': ['Rent', 'Property services', 'Maintenance'],
    'Software & Technology': [
      'Gym management software',
      'POS / software subscriptions',
      'Other SaaS subscriptions',
    ],
    Operations: ['Cleaning', 'Security', 'Repairs', 'Supplies', 'Equipment maintenance'],
    Marketing: ['Advertising', 'Social media', 'Printing', 'Promotions'],
    'Banking & Payment': ['Bank fees', 'Payment gateway fees'],
    Other: ['Miscellaneous'],
  };

  var CATEGORIES = Object.keys(TYPES_BY_CATEGORY);

  global.GfpCashExpenseCatalog = {
    categories: CATEGORIES,
    typesByCategory: TYPES_BY_CATEGORY,
    typesFor: function (category) {
      if (!category) return [];
      var key = CATEGORIES.find(function (item) {
        return item.toLowerCase() === String(category).toLowerCase();
      });
      return key ? TYPES_BY_CATEGORY[key].slice() : [];
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
