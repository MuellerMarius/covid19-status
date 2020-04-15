'use strict';
function addAutocomplete(object, id, data, favs) {
  let focusedItem = -1;

  object.addEventListener('input', onInputChange);
  object.addEventListener('keydown', onKeyDown);
  object.addEventListener('blur', createChart);
  document.addEventListener('click', removeAllItems);

  function onInputChange(e) {
    const inputValue = this.value.toUpperCase();
    const matches = data
      .filter((elem) => elem.toUpperCase().includes(inputValue))
      .sort((a, b) => a.localeCompare(b));
    let itemContainer = document.createElement('div');
    itemContainer.setAttribute('class', `${id}__autocomplete-container`);

    removeAllItems();
    focusedItem = -1;
    if (matches.length < MAX_AUTOCOMPLETE_RESULTS) {
      matches.map((elem) => {
        itemContainer.appendChild(createItem(elem, inputValue));
      });
    } else if (inputValue.length === 0 && favs) {
      favs.map((elem) => {
        itemContainer.appendChild(createItem(elem, inputValue));
      });
    }
    if (itemContainer.hasChildNodes())
      this.parentNode.appendChild(itemContainer);
  }

  function onKeyDown(e) {
    const items = document.getElementsByClassName(`${id}__autocomplete-item`);

    switch (e.keyCode) {
      case 13:
        //Enter
        e.preventDefault();
        this.value = items[focusedItem].attributes.name.value;
        removeAllItems();
        createChart();
        break;
      case 40:
        // Arrow down
        focusedItem = focusedItem === items.length - 1 ? 0 : ++focusedItem;
        markItemActive(focusedItem, items);
        break;
      case 38:
        // Arrow up
        focusedItem = focusedItem === 0 ? items.length - 1 : --focusedItem;
        markItemActive(focusedItem, items);
        break;
      default:
        break;
    }
  }

  function markItemActive(focusedItem, items) {
    const itemsLength = items.length;
    let i = 0;
    for (i; i < itemsLength; i++) {
      if (i === focusedItem) {
        items[i].classList.add(`${id}__autocomplete-item--active`);
      } else {
        items[i].classList.remove(`${id}__autocomplete-item--active`);
      }
    }
  }

  function createItem(label, searchValue) {
    let item = document.createElement('div');
    let index = label.toUpperCase().indexOf(searchValue);

    item.setAttribute('class', `${id}__autocomplete-item`);
    item.setAttribute('name', label);
    item.innerHTML =
      label.substr(0, index) +
      '<strong>' +
      label.substr(index, searchValue.length) +
      '</strong>' +
      label.substr(index + searchValue.length);
    item.addEventListener('click', () => {
      object.value = label;
      createChart();
    });

    return item;
  }

  function removeAllItems() {
    let items = document.getElementsByClassName(
      `${id}__autocomplete-container`
    );
    for (const item of items) {
      item.remove();
    }
  }
}
