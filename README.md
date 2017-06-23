# lazyLoader
jQuery.Deferred()实现的 image lazyLoader 和 ES6 Promise 实现的 image lazyLoader

### 使用如下:
// $.Deferred 实现的 img lazyLoad
```
$imageContainer.find('img').each(function() {
    var $ele = $(this);
    var url = $ele.attr('data-src');
    if (url) {
        $.lazyLoader(url, true, function(image) {
            $ele.attr('src', image.src);
            $ele.addClass('img-show');
        });
        $ele.removeAttr('data-src');
    }
});
```