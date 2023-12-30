export interface Hashable {
    hash(): string;
}

export class HashMap<T extends Hashable, V> {
    private map: Map<String, V>;
    private keyMap: Map<String, T>;

    constructor() {
        this.map = new Map<String, V>;
        this.keyMap = new Map<String, T>;
    }

    public size(): number {
        return this.map.size;
    }

    public set(key:T, value: V): void {
        this.map.set(key.hash(), value);
        if (!this.keyMap.has(key.hash())) {
            this.keyMap.set(key.hash(), key);
        }
    }

    public delete(key: T): void {
        this.keyMap.delete(key.hash());
        this.map.delete(key.hash());
    }

    public has(key: T): boolean {
        return this.map.has(key.hash());
    }

    public get(key: T): V | undefined {
        return this.map.get(key.hash());
    }

    public getOrDefault(key: T, defaultValue: V): V {
        const res = this.map.get(key.hash());
        if (res) {
            return res;
        }
        return defaultValue;
    }

    public keys(): IterableIterator<T> {
        return this.keyMap.values();
    }

    public values(): IterableIterator<V> {
        return this.map.values();
    }

    public entries(): Array<[T, V]> {
        const entries: Array<[T, V]> = new  Array<[T, V]>(); 
        for (const key of this.keys()) {
            const value = this.get(key);
            if (value != undefined) {
                entries.push([key, value]);
            }
        }
        return entries;
    }

    public toMap(): Map<T, V> {
        const map = new Map<T,V>();
        for (const keyHash of this.map.keys()) {
            const key = this.keyMap.get(keyHash);
            const val = this.map.get(keyHash);
            if (key && val) {
                map.set(key, val);
            }
        }
        return map;
    }

    public toString(): string {
        const obj: any = [];
        for (const key of this.keys()) {
            obj[key] = this.get(key);
        }
        return obj.toString();
    }
}

export class HashArray<T extends Hashable> extends Array<T>{
    constructor(...items: T[]) {
        super(...items);
        Object.setPrototypeOf(this, HashArray.prototype);
      }

    public static fromArray<T extends Hashable>(items: T[]): HashArray<T> {
        return new HashArray(...items)
    }

    public hashIncludes(searchElement: T): boolean {
        return super.some((element: T): boolean => element.hash() == searchElement.hash());
    }

    public hashFind(searchElement: T): number {
        return this.findIndex(item => searchElement.hash() == item.hash());
    }

    public hashRemove(searchElement: T, removeAll: boolean=false): boolean {
        let index = this.hashFind(searchElement);
        let removed = false;
        while (index != -1) {
            this.splice(index, 1);
            removed = true;
            index = this.hashFind(searchElement);
            if (!removeAll) {
                break;
            }
        }
        return removed;
    }

    public hashReplace(searchElement: T, replaceElement: T, replaceAll=false): boolean {
        let index = this.hashFind(searchElement);
        let replaced = false;
        while (index != -1) {
            this[index] = replaceElement;
            replaced = true;
            index = this.hashFind(searchElement);
            if (!replaceAll) {
                break;
            }
        }
        return replaced;
    }
}

import Champion from "./champion";
import Trait, {Activation} from "./trait";
import fs from 'fs';
import path from 'path';

// const Akali = new Champion("Akali", 4, "", []);
// const Ahri = new Champion("Ahri", 4, "", []); 
// const Karthus = new Champion("Karthus", 4, "", []); 
// const Zed = new Champion("Zed", 4, "", []); 
// const Zac = new Champion("Zac", 4, "", []);

// const champions = HashArray.fromArray([Akali, Ahri, Karthus, Zed, Zac]);