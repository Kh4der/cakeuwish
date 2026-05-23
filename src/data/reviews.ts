export interface Review {
  name: string
  text: string
  rating: number
}

// Real Google reviews for CakeUWish LLC (4.9★, 194 reviews), lightly tidied for length.
export const REVIEWS: Review[] = [
  { name: 'Alisha Zaveri', rating: 5, text: 'Parul did an amazing job with our wedding cake! It was beautifully decorated and tasted amazing. Prompt and efficient to work with — I would absolutely recommend her to any couple looking for an elegant, delicious wedding cake.' },
  { name: 'Sanjay Kaushal', rating: 5, text: 'CakeUWish truly exceeded all expectations and made our celebration unforgettable! We ordered a two-layer Lego-themed eggless birthday cake for our son, and it was nothing short of a masterpiece — adorned with all-edible Lego pieces.' },
  { name: 'Mittal Mehta', rating: 5, text: 'Stunning eggless birthday cake! Parul did amazing work for a 40th birthday celebration. The theme — purse and makeup — was brought to life with incredible craftsmanship and realistic detail.' },
  { name: 'Ankit Shah', rating: 5, text: "Parul is truly incredible! She baked a raspberry, dark-chocolate cake with ganache for our son's 5th birthday. This was our second cake with her and, as usual, it exceeded our expectations." },
  { name: 'Deepu Krishna', rating: 5, text: 'I recently ordered a cake and it was absolutely delightful! Perfectly moist, and the flavor was spot-on — rich and satisfying without being overly sweet. The presentation was beautiful. Highly recommend.' },
  { name: 'Bhawna Jain', rating: 5, text: 'My second time ordering from Parul and it was outstanding. We needed an eggless and nut-free cake due to allergies and Parul catered to both — and it was beautifully decorated too.' },
  { name: 'Azfar Ali', rating: 5, text: 'The Batman-theme birthday cake far exceeded our expectations! She accommodated us at the last moment, just a few days before our event. Made super neatly and tasted delicious!' },
  { name: 'Winston Sirajuddin', rating: 5, text: "CakeUWish is absolutely amazing. She makes more than just a beautiful cake — it's a complete work of art. My last 5 cakes have been from CakeUWish and each time my guests were amazed." },
  { name: 'Ranjana Govil', rating: 5, text: "Parul's cake is always so beautiful and delicious — it's worth what you pay for. She's a very nice person to deal with, too. I had a great experience with her and her cake!" },
  { name: 'Harini Thyagarajan', rating: 5, text: "We ordered a Sonic-themed vanilla and chocolate cake for our son's 7th birthday along with chocolate-truffle cake pops. Very rich, moist and flavorful — delicious!" },
  { name: 'Nikki Upton', rating: 5, text: 'Cake Wish did a fantastic job with a customized cake for our company. We will definitely order again — thank you for the wonderfully tasting and custom-designed cakes!' },
  { name: 'bheem lal', rating: 5, text: 'Best cake ever we had. Thank you so much, Parul!' },
]

export const GOOGLE_REVIEWS_URL =
  'https://www.google.com/search?q=CakeUWish+LLC+Chantilly+reviews'
