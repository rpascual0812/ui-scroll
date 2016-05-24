angular.module('ui.scroll.grid', [])
  .directive('uiScrollTh', ['$log', '$timeout', function (console, $timeout) {

    function GridAdapter(controller) {

      this.getLayout = () => controller.getLayout();

      this.applyLayout = (layout) => controller.applyLayout(layout);

      this.columnFromPoint = (x,y) => controller.columnFromPoint(x,y);

      Object.defineProperty(this, 'columns', {get: () => controller.getColumns()});
    }

    function ColumnAdapter(controller, column) {

      this.css = function (/* attr, value */) {
        var attr = arguments[0];
        var value = arguments[1];
        if (arguments.length == 1) {
          return column.header.css(attr);
        }
        if (arguments.length == 2) {
          column.header.css(attr, value);
          column.cells.forEach((cell) => cell.css(attr, value));
          column.layout.css[attr] = value;
        }
      };

      this.moveBefore = function (index) {
        controller.moveBefore(column, index);
      };

      this.exchangeWith = function (index) {
        controller.exchangeWith(column, index);
      };

      Object.defineProperty(this, 'columnId', {get: () => column.id})
    }

    function ColumnController(columns, header) {

      this.header = header;
      this.cells = [];
      this.layout = {css: {}};
      this.mapTo = columns.length;
      this.id = columns.length;
      
      this.reset = function () {
        this.header.removeAttr('style');
        this.cells.forEach((cell) => cell.removeAttr('style'));
      };

      function moveBefore(element, target) {
        element.detach();
        target.before(element);
      }

      function moveLast(element, target) {
        let parent = element.parent();
        element.detach();
        parent.append(element);
      }

      this.moveBefore = function(target) {
        if (target) {
          moveBefore(header, target.header);
          this.cells.forEach((cell, i) => moveBefore(cell, target.cells[i]))
        } else {
          moveLast(header);
          this.cells.forEach((cell) => moveLast(cell));
        }
      }

      function insidePoint(element, x,y) {
        let offset = element.offset();
        if (x < offset.left || offset.left + element.outerWidth(true) < x )
          return false;
        if (y < offset.top || offset.top + element.outerHeight(true) < y )
          return false;
        return true;
      }

      this.columnFromPoint = function (x,y) {
        if (insidePoint(header, x,y))
          return this;
        for (let i=0; i<this.cells.length; i++)
          if (insidePoint(this.cells[i], x,y))
            return this;
      } 
    }

    function GridController(scope, scrollViewport) {
      let columns = [];
      let rowMap = new Map();
      let current;
      let index;

      $timeout(() => {
        scrollViewport.adapter.gridAdapter = new GridAdapter(this);
        scrollViewport.adapter.transform = (scope, item) => this.transform(scope, item);
      });

      this.transform = function (scope, item) {
        let row = rowMap.get(scope);
        let parent = row[0].parent();
        let last = row[row.length-1].next();
        let visible = [];
        columns.forEach((column, index) => {
          this.applyCss(row[index], column.layout.css);
          visible[columns[index].mapTo] = row[index];
        });
        let current = visible.shift();
        current.detach();
        if (last.length)
          last.before(current);
        else
          parent.append(current);

        visible.forEach((cell) => {
          cell.detach();
          current.after(cell);
          current = cell;
        });


      }

      this.registerColumn = function (header) {
        columns.push(new ColumnController(columns, header));
      };

      this.applyCss = function (target, css) {
        for (let attr in css)
          if (css.hasOwnProperty(attr))
            target.css(attr, css[attr]);
      };

      this.registerCell = function (scope, cell) {
        if (current !== scope) {
          index = 0;
          current = scope;
        }
        if (index < columns.length) {
          columns[index].cells.push(cell);
          
          let row = rowMap.get(scope);
          if (!row) {
            row = [];
            rowMap.set(scope, row);
          }
          row[index] = cell;
          
          return index++;
        }
        return -1;
      };

      this.unregisterCell = function (scope, column, cell) {
        let index = columns[column].cells.indexOf(cell);
        columns[column].cells.splice(index, 1);

        let row = rowMap.get(scope);
        let i = row.indexOf(cell);
        row.splice(i, 1);
        if (!row.length)
          rowMap.delete(scope);

      };

      this.getColumns = function () {
        let result = [];
        columns.slice().sort((a,b) => {return a.mapTo - b.mapTo;})
          .forEach((column) => result.push(new ColumnAdapter(this, column)));
        return result;
      };

      this.getLayout = function () {
        let result = [];
        columns.forEach((column, index) => result.push({
            index: index,
            layout: {css: angular.extend({}, column.layout.css)},
            mapTo: column.mapTo
          })
        );
        return result;
      };

      this.applyLayout = function (columnDescriptors) {
        if (!columnDescriptors || !columnDescriptors.length) {
          return console.warn('Nothing to apply.');
        }
        columnDescriptors.forEach((columnDescriptor, index) => {
          if (index < 0 || index >= columns.length)
            return;
          let columnAdapter = new ColumnAdapter(this, columns[index]);
          columns[index].reset();
          this.applyCss(columnAdapter, columnDescriptor.layout.css);
        });
      };

      this.moveBefore = function (selected, target) {
        let index = target;

        if (target % 1 !== 0)
          index = target ? columns[target.columnId].mapTo : columns.length;

        if (index < 0 || index > columns.length)
          return; // throw an error?

        let mapTo = selected.mapTo, next;
        index -= mapTo < index ? 1 : 0;

        columns.forEach(c => {
          c.mapTo -= c.mapTo > mapTo ? 1 : 0;
          c.mapTo += c.mapTo >= index ? 1 : 0;
          next = c.mapTo === index + 1 ? c : next;
        });

        selected.mapTo = index;
        selected.moveBefore(next);
      };

      this.exchangeWith = function (selected, index) {
        if (index < 0 || index >= columns.length)
          return;
        columns.find(c => c.mapTo === index).mapTo = selected.mapTo;
        selected.mapTo = index;
      };

      this.columnFromPoint = function(x,y) {
        for (let i=0; i<columns.length; i++) {
          var column = columns[i].columnFromPoint(x,y);
          if (column)
            break;
        }
        if (column)
          return new ColumnAdapter(this, column);
        return undefined;
      };
    }

    return {
      require: ['^^uiScrollViewport'],
      restrict: 'A',
      link: ($scope, element, $attr, controllers, linker) => {
        controllers[0].gridController = controllers[0].gridController || new GridController($scope, controllers[0]);
        controllers[0].gridController.registerColumn(element);
      }
    }
  }])

  .directive('uiScrollTd', ['$log', function (console) {
    return {
      require: ['?^^uiScrollViewport'],
      restrict: 'A',
      link: ($scope, element, $attr, controllers, linker) => {
        if (controllers[0]) {
          let gridController = controllers[0].gridController;
          let index = gridController.registerCell($scope, element);
          if (index >= 0) {
            element.attr('ui-scroll-td', index);
            $scope.$on('$destroy', () => gridController.unregisterCell($scope, index, element));
          }
        }
      }
    }
  }]);