<?php

namespace App\Domains\DirectorySync\Drivers;

interface DirectorySyncDriver
{
    /**
     * @return array{users: list<array{external_id:string,email:string,first_name:?string,last_name:?string}>, groups: list<array{external_id:string,name:string,member_external_ids:list<string>}>}
     */
    public function fetch(): array;
}
