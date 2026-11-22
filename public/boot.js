// Runs before the first paint (kept tiny, same-origin so the Content-Security-Policy needs no 'unsafe-inline').
// 1. Apply the visitor's saved theme, so the page never flashes the default colours.
try {
  var saved = localStorage.getItem('campusFoodTheme')
  if (saved) document.documentElement.dataset.theme = saved
} catch (e) {}
// 2. Turn on the Google Fonts stylesheet once it has loaded, so fonts never block the first paint.
document.querySelectorAll('link[data-defer-style]').forEach(function (link) {
  if (link.sheet) link.media = 'all'
  else link.addEventListener('load', function () { link.media = 'all' })
})
