// refer to: https://github.com/andreivictor/select2-dropdownPosition/blob/master/select2-dropdownPosition.js

;(function($) {

  let Defaults = $.fn.select2.amd.require('select2/defaults');

  $.extend(Defaults.defaults, {
    dropdownPosition: 'auto'
  });

  let AttachBody = $.fn.select2.amd.require('select2/dropdown/attachBody');

  let _positionDropdown = AttachBody.prototype._positionDropdown;

  AttachBody.prototype._positionDropdown = function() {

    let $window = $(window);

    let isCurrentlyAbove = this.$dropdown.hasClass('select2-dropdown--above');
    let isCurrentlyBelow = this.$dropdown.hasClass('select2-dropdown--below');

    let newDirection = null;

    let offset = this.$container.offset();

    offset.bottom = offset.top + this.$container.outerHeight(false);

    let container = {
      height: this.$container.outerHeight(false)
    };

    container.top = offset.top;
    container.bottom = offset.top + container.height;

    let dropdown = {
      height: this.$dropdown.outerHeight(false)
    };

    let viewport = {
      top: $window.scrollTop(),
      bottom: $window.scrollTop() + $window.height()
    };

    let enoughRoomAbove = viewport.top < (offset.top - dropdown.height);
    let enoughRoomBelow = viewport.bottom > (offset.bottom + dropdown.height);

    let css = {
      left: offset.left,
      top: container.bottom
    };

    // Determine what the parent element is to use for calciulating the offset
    let $offsetParent = this.$dropdownParent;

    // For statically positoned elements, we need to get the element
    // that is determining the offset
    if ($offsetParent.css('position') === 'static') {
      $offsetParent = $offsetParent.offsetParent();
    }

    let parentOffset = $offsetParent.offset();

    css.top -= parentOffset.top
    css.left -= parentOffset.left;

    let dropdownPositionOption = this.options.get('dropdownPosition');

    if (dropdownPositionOption === 'above' || dropdownPositionOption === 'below') {

      newDirection = dropdownPositionOption;

    } else {

      if (!isCurrentlyAbove && !isCurrentlyBelow) {
        newDirection = 'below';
      }

      if (!enoughRoomBelow && enoughRoomAbove && !isCurrentlyAbove) {
        newDirection = 'above';
      } else if (!enoughRoomAbove && enoughRoomBelow && isCurrentlyAbove) {
        newDirection = 'below';
      }

    }

    if (newDirection == 'above' ||
        (isCurrentlyAbove && newDirection !== 'below')) {
      css.top = container.top - parentOffset.top - dropdown.height;
    }

    if (newDirection != null) {
      this.$dropdown
        .removeClass('select2-dropdown--below select2-dropdown--above')
        .addClass('select2-dropdown--' + newDirection);
      this.$container
        .removeClass('select2-container--below select2-container--above')
        .addClass('select2-container--' + newDirection);
    }

    this.$dropdownContainer.css(css);

  };

})(window.jQuery);