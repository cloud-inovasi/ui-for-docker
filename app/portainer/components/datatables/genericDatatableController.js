import './datatable.css';

angular.module('portainer.app')
.controller('GenericDatatableController', ['PaginationService', 'DatatableService', 'PAGINATION_MAX_ITEMS',
function (PaginationService, DatatableService, PAGINATION_MAX_ITEMS) {

  this.state = {
    selectAll: false,
    orderBy: this.orderBy,
    paginatedItemLimit: PAGINATION_MAX_ITEMS,
    displayTextFilter: false,
    selectedItemCount: 0,
    selectedItems: []
  };


  this.onTextFilterChange = function() {
    DatatableService.setDataTableTextFilters(this.tableKey, this.state.textFilter);
  };

  this.changeOrderBy = function(orderField) {
    this.state.reverseOrder = this.state.orderBy === orderField ? !this.state.reverseOrder : false;
    this.state.orderBy = orderField;
    DatatableService.setDataTableOrder(this.tableKey, orderField, this.state.reverseOrder);
  };

  this.selectItem = function(item) {
    if (item.Checked) {
      this.state.selectedItemCount++;
      this.state.selectedItems.push(item);
    } else {
      this.state.selectedItems.splice(this.state.selectedItems.indexOf(item), 1);
      this.state.selectedItemCount--;
    }
  };

  this.selectAll = function() {
    for (var i = 0; i < this.state.filteredDataSet.length; i++) {
      var item = this.state.filteredDataSet[i];
      if (item.Checked !== this.state.selectAll) {
        item.Checked = this.state.selectAll;
        this.selectItem(item);
      }
    }
  };

  this.changePaginationLimit = function() {
    PaginationService.setPaginationLimit(this.tableKey, this.state.paginatedItemLimit);
  };

  this.$onInit = function() {
    setDefaults(this);

    var storedOrder = DatatableService.getDataTableOrder(this.tableKey);
    if (storedOrder !== null) {
      this.state.reverseOrder = storedOrder.reverse;
      this.state.orderBy = storedOrder.orderBy;
    }

    var textFilter = DatatableService.getDataTableTextFilters(this.tableKey);
    if (textFilter !== null) {
      this.state.textFilter = textFilter;
      this.onTextFilterChange();
    }
  };

  function setDefaults(ctrl) {
    ctrl.showTextFilter = ctrl.showTextFilter ? ctrl.showTextFilter : false;
    ctrl.state.reverseOrder = ctrl.reverseOrder ? ctrl.reverseOrder : false;
    ctrl.state.paginatedItemLimit = PaginationService.getPaginationLimit(ctrl.tableKey);
  }
}]);
