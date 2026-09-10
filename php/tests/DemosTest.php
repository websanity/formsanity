<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Form;

final class DemosTest extends TestCase
{
	private static function form(string $demo): Form
	{
		return Form::parse((string) file_get_contents(__DIR__ . '/../../demos/' . $demo));
	}

	public function testEveryDemoParses(): void
	{
		foreach (['required.html', 'types.html', 'limits.html', 'comparisons.html', 'relevance.html', 'operations.html', 'submission.html', 'layout.html'] as $demo) {
			self::assertInstanceOf(Form::class, self::form($demo), $demo);
		}
	}

	/** @return iterable<string, array{string, array, list<array{?string, string}>}> */
	public static function violations(): iterable
	{
		yield 'required demo: empty name' => ['required.html', ['email' => 'a@b.co'], [['full-name', 'required']]];
		yield 'required demo: at least one ticket' => ['required.html', ['full-name' => 'J', 'email' => 'a@b.co', 'password' => 'x', 'flavor' => 'v', 'multi-select' => ['a'], 'bio' => 'b', 'radio-list' => ['radio-01']], [['attachment', 'required'], ['club-seats', 'group.required-any']]];
		yield 'relevance demo: value for an irrelevant field' => ['relevance.html', ['color' => 'Red', 'other-color' => 'teal'], [['other-color', 'relevance']]];
		yield 'relevance demo: irrelevant journal tier' => ['relevance.html', ['member-type' => ['Student'], 'journal' => ['Standard Print']], [['journal', 'relevance']]];
		yield 'relevance demo: region option' => ['relevance.html', ['country' => 'US', 'region' => 'CA-ON'], [['region', 'relevance']]];
		yield 'required demo: conditional phone' => ['required.html', ['contact' => ['phone'], 'contact-phone' => ''], [['contact-phone', 'required']]];
		yield 'required demo: conditional set' => ['required.html', ['contact-me' => ['on'], 'reach' => []], [['reach', 'required']]];
	}

	#[DataProvider('violations')]
	public function testAViolationReportsItsCode(string $demo, array $payload, array $expected): void
	{
		$errors = array_map(fn ($e) => [$e['field'], $e['code']], self::form($demo)->validate($payload)->errors());
		foreach ($expected as $pair) {
			self::assertContains($pair, $errors, json_encode($errors));
		}
	}
}
