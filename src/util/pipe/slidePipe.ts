import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'slidePipe',
  pure: false
})
export class SlidePipe implements PipeTransform {
  transform(items: any[], num:number): any[] {
    if (!items || items.length < 1|| !num) {
      return items;
    }
    let outList = [],innerList = [];
    for(let i = 0;i<items.length;i++){
      innerList.push(items[i]);
       if(i%num===num-1||(i===items.length-1)){
          outList.push([...innerList]);
         innerList = [];
       }
    }
    return outList;
  }

}
