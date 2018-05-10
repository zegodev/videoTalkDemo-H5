import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../base-path/base-path';
import { map } from 'rxjs/operators';

/*
 Generated class for the IndexProvider provider.

 See https://angular.io/guide/dependency-injection for more info on providers
 and Angular DI.
 */
@Injectable()
export class IndexProvider {

    constructor(public http: HttpClient) {
        console.log('Hello IndexProvider Provider');
    }

    getContentList(pageIndex: number, pageSize = '10') {
        return this.http.get(environment.getUrl('blog/getArticles'), {
            params: {
                pageIndex: pageIndex + '',
                pageSize,
                tag:''
            }
        })
            .pipe(
                map((item:{status:'1'|'0',data:{list:any[],totalCount:number}}) => {
                    if(item.status === '0'){
                        return {
                            list:this.formatterList(item.data.list),
                            totalCount:item.data.totalCount
                        };
                    }
                })
            );
    }

    getAllTags() {
        return this.http.get(environment.getUrl('blog/getTag'));
    }

    formatterList(result: any[]): { title: string, group: any[] }[] {
        let titleMap: Map<string, any[]> = new Map<string, any[]>();
        result.forEach(item => {
            item.article_createTime && item.article_createTime.substr(0, 7) && titleMap.set(item.article_createTime.substr(0, 7), []);
        });
        result.forEach(item => {
            const key = item.article_createTime && item.article_createTime.substr(0, 7) || '';
            if (titleMap.has(key)) {
                titleMap.get(key).push(item);
            }
        });

        let groups: { title: string, group: any[] }[] = [];
        titleMap.forEach((value, key) => {
            groups.push({
                title: key,
                group: value
            })
        });
        return groups;
    }

    getContentListByTag(tag: string, pageIndex: number, pageSize = '20') {
        return this.http.get(environment.getUrl('blog/getArticles'), {
            params: {
                pageIndex: pageIndex + '',
                pageSize,
                tag
            }
        })
    }
}
