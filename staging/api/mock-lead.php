<?php
// STAGING MOCK. Never forwards leads anywhere. Validates, appends a masked line to a log OUTSIDE the web root,
// and answers in the same JSON shape the hub expects (see FIELD_MAP / isSuccess in assets/js/config.js).
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');

function reply($ok, $msg, $code = 200) { http_response_code($code); echo json_encode(['success' => $ok, 'message' => $msg]); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(false, 'Method not allowed', 405);

$in = $_POST;
if (!$in) { $j = json_decode(file_get_contents('php://input'), true); if (is_array($j)) $in = $j; }
$g = function ($k) use ($in) { return isset($in[$k]) && is_string($in[$k]) ? trim($in[$k]) : ''; };

if ($g('website') !== '') reply(true, 'Thank you');                       // honeypot
if (mb_strlen($g('name')) < 2) reply(false, 'Invalid name', 422);
if (!preg_match('/^\d{10}$/', $g('mobile'))) reply(false, 'Invalid mobile', 422);
if (!filter_var($g('email'), FILTER_VALIDATE_EMAIL)) reply(false, 'Invalid email', 422);
if (mb_strlen($g('city')) < 2) reply(false, 'Invalid city', 422);

$dir = dirname(__DIR__, 2) . '/_private';                                  // sibling of the web root
if (!is_dir($dir)) @mkdir($dir, 0750, true);
$line = json_encode([
  'time' => date('c'), 'source' => $g('source'), 'college' => $g('college'), 'program' => $g('program'), 'page' => $g('page'),
  'name' => mb_substr($g('name'), 0, 1) . '***', 'mobile' => '******' . substr($g('mobile'), -4),
  'email' => substr($g('email'), 0, 1) . '***@' . substr(strrchr($g('email'), '@'), 1),
  'city' => $g('city'), 'utm' => array_filter($in, function ($k) { return strpos($k, 'utm_') === 0; }, ARRAY_FILTER_USE_KEY),
]) . "\n";
@file_put_contents($dir . '/mock-leads.log', $line, FILE_APPEND | LOCK_EX);
reply(true, 'Thank you');
