<?php
// A publication must refer to the exact snapshot the editor loaded.
function termburg_schedule_revision($payload) {
    return hash('sha256', wp_json_encode(array(
        'site' => $payload['site'] ?? 'zelenogorsk',
        'events' => $payload['events'] ?? array(),
    )));
}

function termburg_schedule_state() {
    $payload = get_option('termburg_schedule_import_payload', array());
    $response = rest_ensure_response(array(
        'protocol' => 1,
        'site' => $payload['site'] ?? 'zelenogorsk',
        'revision' => termburg_schedule_revision($payload),
        'updatedAt' => $payload['updatedAt'] ?? '',
        'count' => count($payload['events'] ?? array()),
        'events' => $payload['events'] ?? array(),
    ));
    $response->header('Cache-Control', 'no-store');
    return $response;
}

add_action('rest_api_init', function () {
    register_rest_route('termburg/v1', '/schedule/state', array(
        'methods' => 'GET',
        'callback' => 'termburg_schedule_state',
        'permission_callback' => '__return_true',
    ));
});

function termburg_api_schedule_import($request) {
    global $wpdb;
    $expected = trim((string)$request->get_header('if-match'), '" ');
    if (!preg_match('/^[a-f0-9]{64}$/', $expected)) {
        return new WP_Error('schedule_version_required', 'Обновите программу и загрузите актуальное расписание с сайта: старая копия не может перезаписать публикацию.', array('status' => 428));
    }
    // MySQL named lock also serializes separate PHP workers, unlike an in-memory flag.
    $lock = 'tb_schedule_' . substr(hash('sha256', $wpdb->prefix), 0, 32);
    $acquired = $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $lock));
    if ((string)$acquired !== '1') {
        return new WP_Error('schedule_busy', 'Расписание сейчас сохраняется. Повторите отправку.', array('status' => 503));
    }
    try {
        // Drop this request's option cache after acquiring the cross-process lock.
        wp_cache_delete('termburg_schedule_import_payload', 'options');
        $current = get_option('termburg_schedule_import_payload', array());
        if (!hash_equals(termburg_schedule_revision($current), $expected)) {
            return new WP_Error('schedule_version_conflict', 'На сайте уже есть более новая версия. Нажмите «Загрузить с сайта», затем внесите изменения заново.', array('status' => 409));
        }
        $result = termburg_api_schedule_import_legacy($request);
        if (!is_wp_error($result)) {
            $body = $result->get_data();
            $body['revision'] = termburg_schedule_revision(get_option('termburg_schedule_import_payload', array()));
            $result->set_data($body);
        }
        return $result;
    } finally {
        $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
    }
}
