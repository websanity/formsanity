<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests\Validation;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Markup\Parser;
use WebSanity\FormSanity\Payload\Normalizer;
use WebSanity\FormSanity\Validation\Relevance;

final class RelevanceTest extends TestCase
{
	private static function relevance(string $inner, array $payload): Relevance
	{
		$form = Parser::parse('<!DOCTYPE html><form data-fs-form action="/x">' . $inner . '</form>');
		return new Relevance($form, Normalizer::normalize($payload, [], $form));
	}

	public function testAFieldFollowsItsOwnExpression(): void
	{
		$inner = '<select name="color"><option value="">c</option><option value="Other">Other</option></select><input name="other" type="text" data-fs-relevant="color == \'Other\'">';
		self::assertFalse(self::relevance($inner, ['color' => ''])->isFieldRelevant('other'));
		self::assertTrue(self::relevance($inner, ['color' => 'Other'])->isFieldRelevant('other'));
	}

	public function testARegionGovernsEveryControlInsideIt(): void
	{
		$inner = '<input name="pay" type="text"><ul data-fs-relevant="pay == \'card\'"><li><input name="card" type="text"></li></ul>';
		self::assertFalse(self::relevance($inner, ['pay' => 'invoice'])->isFieldRelevant('card'));
		self::assertTrue(self::relevance($inner, ['pay' => 'card'])->isFieldRelevant('card'));
	}

	public function testMembersDecideForThemselvesAndTheSetReadsItsRelevantMembers(): void
	{
		$inner = '<input type="radio" name="member-type" value="Standard"><input type="radio" name="member-type" value="Student"><input type="radio" name="journal" value="Standard Print" data-fs-relevant="member-type == \'Standard\'"><input type="radio" name="journal" value="Reduced" data-fs-relevant="member-type == \'Student\'"><input type="radio" name="journal" value="Online">';
		$r = self::relevance($inner, ['member-type' => ['Student'], 'journal' => ['Standard Print']]);
		self::assertFalse($r->isControlRelevant('journal', 0));
		self::assertTrue($r->isControlRelevant('journal', 1));
		self::assertTrue($r->isFieldRelevant('journal'));
		self::assertSame([], $r->valueOf('journal'));
	}

	public function testAWhollyIrrelevantSetIsAnIrrelevantField(): void
	{
		$inner = '<input type="checkbox" name="on" value="on"><input type="checkbox" name="opts" value="a" data-fs-relevant="on == \'on\'"><input type="checkbox" name="opts" value="b" data-fs-relevant="on == \'on\'">';
		self::assertFalse(self::relevance($inner, ['on' => [], 'opts' => ['a']])->isFieldRelevant('opts'));
	}

	public function testOptionsAndTheNoChoiceSelect(): void
	{
		$inner = '<input name="fuel" type="text"><select name="charger"><option value="ccs" data-fs-relevant="fuel == \'electric\'">CCS</option><option value="chademo" data-fs-relevant="fuel == \'electric\'">CHAdeMO</option></select><select name="octane"><option value="">c</option><option value="93" data-fs-relevant="fuel == \'petrol\'">93</option></select>';
		$r = self::relevance($inner, ['fuel' => 'petrol', 'charger' => 'ccs', 'octane' => '93']);
		self::assertFalse($r->isFieldRelevant('charger'));
		self::assertTrue($r->isFieldRelevant('octane'));
		self::assertTrue($r->isOptionRelevant('octane', '93'));
		self::assertFalse($r->isOptionRelevant('charger', 'ccs'));
	}

	public function testMutualExclusionSettles(): void
	{
		$inner = '<input type="checkbox" name="roles" value="Head" data-fs-relevant="roles != \'Manager\'"><input type="checkbox" name="roles" value="Manager" data-fs-relevant="roles != \'Head\'">';
		$r = self::relevance($inner, ['roles' => ['Head']]);
		self::assertTrue($r->isControlRelevant('roles', 0));
		self::assertFalse($r->isControlRelevant('roles', 1));
		self::assertSame(['Head'], $r->valueOf('roles'));
	}
}
